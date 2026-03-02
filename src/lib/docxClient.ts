"use client";

import mammoth from "mammoth";

/**
 * 在浏览器中从 DOCX 文件提取纯文本（仅客户端）
 */
export async function getTextFromDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result?.value ?? "";
}
