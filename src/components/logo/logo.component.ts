// 开源项目，未经作者同意，不得以抄袭/复制代码/修改源代码版权信息。
// Copyright @ 2018-present xiejiahe. All rights reserved.
// See https://github.com/xjh22222228/nav
import {
  Component,
  Input,
  ChangeDetectionStrategy,
  OnChanges,
  SimpleChanges,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { getTextContent } from 'src/utils'

const fallbackColors = [
  { background: '#e8f0ff', foreground: '#315dc4' },
  { background: '#e4f5f1', foreground: '#16775e' },
  { background: '#f1ebff', foreground: '#6948b5' },
  { background: '#fff1e5', foreground: '#a85c24' },
  { background: '#e8f4fa', foreground: '#286c91' },
]

@Component({
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-logo',
  templateUrl: './logo.component.html',
  styleUrls: ['./logo.component.scss'],
})
export class LogoComponent implements OnChanges {
  @Input() src: string = ''
  @Input() url: string = ''
  @Input() name: string = ''
  @Input() size: number = 35
  @Input() radius: number = 9

  backgroundColor: string = fallbackColors[0].background
  foregroundColor: string = fallbackColors[0].foreground
  firstLetter: string = '↗'
  imageLoaded = false
  imageSrc: string = ''
  private imageCandidates: string[] = []
  private candidateIndex = 0

  get fallbackFontSize(): string {
    return `${this.size > 0 ? Math.max(13, Math.round(this.size * 0.48)) : 18}px`
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['src'] || changes['url']) this.updateImageCandidates()
    if (changes['name']) this.updateFallback()
  }

  private updateImageCandidates() {
    const candidates = [this.src?.trim() || '']
    try {
      const url = new URL(this.url.replace(/^\^/, ''))
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        candidates.push(new URL('/favicon.ico', url).href)
        candidates.push(new URL('/apple-touch-icon.png', url).href)
      }
    } catch {
      // Local routes and custom actions do not have a site favicon.
    }
    this.imageCandidates = [...new Set(candidates.filter(Boolean))]
    this.candidateIndex = 0
    this.imageSrc = this.imageCandidates[0] || ''
    this.imageLoaded = false
  }

  private updateFallback() {
    const name = getTextContent(this.name || '').trim()
    this.firstLetter = Array.from(name)[0]?.toUpperCase() || '↗'
    const hash = Array.from(name).reduce(
      (value, character) => (value * 31 + character.codePointAt(0)!) >>> 0,
      0,
    )
    const color = fallbackColors[hash % fallbackColors.length]
    this.backgroundColor = color.background
    this.foregroundColor = color.foreground
  }

  onError() {
    this.candidateIndex += 1
    this.imageSrc = this.imageCandidates[this.candidateIndex] || ''
    this.imageLoaded = false
  }

  onLoad() {
    this.imageLoaded = true
  }
}
