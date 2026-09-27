import { CommonModule } from '@angular/common'
import { Component, OnDestroy, OnInit } from '@angular/core'
import { $t, isZhCN } from 'src/locale'

interface WeatherCity {
  name: string
  latitude: number
  longitude: number
  admin1?: string
  country?: string
}

interface WeatherForecast {
  current: {
    temperature_2m: number
    weather_code: number
  }
  daily: {
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    weather_code: number[]
  }
}

const CITY_STORAGE_KEY = 'nav-weather-city'

@Component({
  standalone: true,
  selector: 'app-weather',
  imports: [CommonModule],
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss'],
})
export class WeatherComponent implements OnInit, OnDestroy {
  readonly $t = $t
  city: WeatherCity | null = null
  forecast: WeatherForecast | null = null
  searchOpen = false
  query = ''
  results: WeatherCity[] = []
  searching = false
  loading = false
  error = ''
  searchError = ''

  private searchTimer?: ReturnType<typeof setTimeout>
  private searchController?: AbortController
  private forecastController?: AbortController

  ngOnInit() {
    try {
      const saved = localStorage.getItem(CITY_STORAGE_KEY)
      if (saved) {
        const city = JSON.parse(saved) as WeatherCity
        if (
          typeof city.name === 'string' &&
          Number.isFinite(city.latitude) &&
          Number.isFinite(city.longitude)
        ) {
          this.selectCity(city)
        }
      }
    } catch {
      // Ignore invalid or unavailable browser storage.
    }
  }

  ngOnDestroy() {
    clearTimeout(this.searchTimer)
    this.searchController?.abort()
    this.forecastController?.abort()
  }

  toggleSearch() {
    this.searchOpen = !this.searchOpen
    this.searchError = ''
    if (!this.searchOpen) {
      clearTimeout(this.searchTimer)
      this.searchController?.abort()
      this.searching = false
      this.results = []
      this.query = ''
    }
  }

  onSearch(event: Event) {
    this.query = (event.target as HTMLInputElement).value.trim()
    this.results = []
    this.searchError = ''
    clearTimeout(this.searchTimer)
    this.searchController?.abort()
    this.searching = false

    if (this.query.length < 2) {
      return
    }

    this.searchTimer = setTimeout(() => this.searchCities(this.query), 300)
  }

  async searchCities(query: string) {
    const controller = new AbortController()
    this.searchController = controller
    this.searching = true
    try {
      const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
      url.searchParams.set('name', query)
      url.searchParams.set('count', '6')
      url.searchParams.set('language', isZhCN() ? 'zh' : 'en')
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) throw new Error(`Geocoding failed: ${response.status}`)
      const data = (await response.json()) as { results?: WeatherCity[] }
      this.results = data.results || []
      if (!this.results.length) this.searchError = $t('_weatherNoCity')
    } catch {
      if (!controller.signal.aborted)
        this.searchError = $t('_weatherSearchError')
    } finally {
      if (this.searchController === controller) this.searching = false
    }
  }

  selectCity(city: WeatherCity) {
    clearTimeout(this.searchTimer)
    this.searchController?.abort()
    this.searching = false
    this.city = city
    this.forecast = null
    this.searchOpen = false
    this.results = []
    this.query = ''
    this.error = ''
    try {
      localStorage.setItem(CITY_STORAGE_KEY, JSON.stringify(city))
    } catch {
      // Weather still works if browser storage is disabled.
    }
    void this.loadWeather()
  }

  locate() {
    if (!navigator.geolocation) {
      this.searchError = $t('_weatherLocationError')
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        this.selectCity({
          name: $t('_weatherCurrentLocation'),
          latitude: coords.latitude,
          longitude: coords.longitude,
        }),
      () => (this.searchError = $t('_weatherLocationError')),
      { timeout: 10000, maximumAge: 600000 },
    )
  }

  async loadWeather() {
    if (!this.city) return
    this.forecastController?.abort()
    const controller = new AbortController()
    this.forecastController = controller
    this.loading = true
    this.error = ''
    try {
      const url = new URL('https://api.open-meteo.com/v1/forecast')
      url.searchParams.set('latitude', String(this.city.latitude))
      url.searchParams.set('longitude', String(this.city.longitude))
      url.searchParams.set('current', 'temperature_2m,weather_code')
      url.searchParams.set(
        'daily',
        'temperature_2m_max,temperature_2m_min,weather_code',
      )
      url.searchParams.set('timezone', 'auto')
      url.searchParams.set('forecast_days', '2')
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) throw new Error(`Forecast failed: ${response.status}`)
      this.forecast = (await response.json()) as WeatherForecast
    } catch {
      if (!controller.signal.aborted) this.error = $t('_weatherLoadError')
    } finally {
      if (this.forecastController === controller) this.loading = false
    }
  }

  weatherIcon(code: number): string {
    if (code === 0) return '☀️'
    if (code <= 3) return '⛅'
    if (code <= 48) return '🌫️'
    if (code <= 67) return '🌧️'
    if (code <= 77) return '❄️'
    if (code <= 82) return '🌦️'
    if (code <= 86) return '🌨️'
    return '⛈️'
  }

  weatherText(code: number): string {
    if (code === 0) return $t('_weatherClear')
    if (code <= 3) return $t('_weatherCloudy')
    if (code <= 48) return $t('_weatherFog')
    if (code <= 67) return $t('_weatherRain')
    if (code <= 77) return $t('_weatherSnow')
    if (code <= 82) return $t('_weatherShowers')
    if (code <= 86) return $t('_weatherSnow')
    return $t('_weatherThunder')
  }
}
