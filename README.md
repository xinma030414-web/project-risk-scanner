This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Project Risk Scanner – 本地运行与验证

- 安装依赖：`npm install`
- 配置环境：在项目根目录创建 `.env.local`（不要提交到 Git），仅设置 `OPENAI_API_KEY=你的密钥`。无需数据库。
- 启动：`npm run dev`，浏览器打开 [http://localhost:3000](http://localhost:3000)
- 验证文本分析：在「项目描述」输入一段文字，点击 **Analyze**，应看到 15 条风险、Top 5、2×2 矩阵
- 验证文件上传分析：上传 `.pdf` 或 `.docx`（可不填描述），点击 **Analyze**，应同样得到 15 条风险 + Top 5 + 2×2 矩阵

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
