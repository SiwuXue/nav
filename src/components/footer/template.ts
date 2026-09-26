const t: Record<string, any> = {
  footTemplate1: `
<div class="bg-white py-8 px-4 mx-auto text-center dark-bg dark-border-color">
  <div class="dark-white text-base font-bold mb-3">$\{hostname}</div>
  <div class="text-gray-600 dark-white-700 mb-3">共收录 $\{total} 个网站</div>
  <div>
    <a class="applyweb">申请收录</a>
  </div>
</div>
`,

  footTemplate2: `
<div class="dark-white">
  <div>共收录$\{total}个网站</div>
  <div>Copyright © 2018-$\{year} $\{hostname}, All Rights Reserved</div>  
</div>
`,

  footTemplate3: `
<div
  class="text-gray-600 dark-white px-3.5 max-w-full text-xs py-1 text-center"
>
  Copyright © $\{year} $\{hostname} · 共收录 $\{total} 个网站
</div>
  `,
}

export default t
