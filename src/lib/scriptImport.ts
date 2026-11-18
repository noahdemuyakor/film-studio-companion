"use client";
/**
 * Script import for the Drama Studio: PDF, DOCX, FDX (Final Draft), Fountain, TXT and MD, up to 10 MB.
 * Everything is read in the browser; nothing is uploaded anywhere.
 */

export const SCRIPT_ACCEPT = ".pdf,.docx,.fdx,.fountain,.txt,.md,.markdown,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const SCRIPT_MAX_BYTES = 10 * 1024 * 1024;

const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
const PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

export async function readScriptFile(file: File): Promise<string> {
  if (file.size > SCRIPT_MAX_BYTES) throw new Error(`"${file.name}" is ${(file.size / 1048576).toFixed(1)} MB; the limit is 10 MB.`);
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  let text: string;
  if (ext === "pdf" || file.type === "application/pdf") text = await fromPdf(file);
  else if (ext === "docx") text = await fromDocx(file);
  else if (ext === "fdx") text = fromFdx(await file.text());
  else if (ext === "doc") throw new Error("Old .doc files can't be read. Save it as .docx or PDF and try again.");
  else text = await file.text();
  text = text.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) throw new Error(`No text found in "${file.name}". If it's a scanned PDF, it has no text layer to read.`);
  return text;
}

/* ---------------------------- Final Draft (.fdx) ---------------------------- */
function fromFdx(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("This .fdx file isn't valid Final Draft XML.");
  const out: string[] = [];
  let speaker = "";
  doc.querySelectorAll("Content > Paragraph").forEach((p) => {
    const type = p.getAttribute("Type") || "";
    const t = [...p.querySelectorAll("Text")].map((x) => x.textContent || "").join("").trim();
    if (!t) return;
    if (type === "Scene Heading") {
      out.push("", t.toUpperCase());
      speaker = "";
    } else if (type === "Character") speaker = t.replace(/\s*\(.*\)\s*$/, "").toUpperCase();
    else if (type === "Dialogue") {
      out.push(speaker ? `${speaker}: ${t}` : t);
    } else if (type === "Parenthetical") {
      /* acting notes: skipped, the line that follows keeps the speaker */
    } else if (type === "Transition") out.push(t.toUpperCase());
    else {
      out.push(t);
      speaker = "";
    }
  });
  return out.join("\n");
}

/* --------------------------------- .docx --------------------------------- */
async function fromDocx(file: File): Promise<string> {
  const xml = await unzipEntry(new Uint8Array(await file.arrayBuffer()), "word/document.xml");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const paras = [...doc.getElementsByTagNameNS(W, "p")].map((p) => {
    let s = "";
    p.querySelectorAll("*").forEach((n) => {
      if (n.localName === "t") s += n.textContent || "";
      else if (n.localName === "tab") s += "\t";
      else if (n.localName === "br" || n.localName === "cr") s += "\n";
    });
    return s;
  });
  return paras.join("\n");
}

/** Reads one file out of a .zip (stored or deflated) with the browser's own decompressor. */
async function unzipEntry(buf: Uint8Array, name: string): Promise<string> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("This .docx file is damaged (no zip directory).");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  for (let k = 0; k < count; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const elen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const fname = dec.decode(buf.subarray(p + 46, p + 46 + nlen));
    if (fname === name) {
      const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      const data = buf.subarray(start, start + csize);
      if (method === 0) return dec.decode(data);
      if (method !== 8) throw new Error("This .docx uses a compression the browser can't read.");
      const stream = new Blob([data.slice()]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return await new Response(stream).text();
    }
    p += 46 + nlen + elen + clen;
  }
  throw new Error("This file isn't a Word .docx document.");
}

/* ---------------------------------- PDF ---------------------------------- */
type PdfItem = { str: string; hasEOL?: boolean; transform: number[] };
async function fromPdf(file: File): Promise<string> {
  // pdf.js is loaded on demand from the CDN, only when someone opens a PDF.
  const load = new Function("u", "return import(u)") as (u: string) => Promise<{
    GlobalWorkerOptions: { workerSrc: string };
    getDocument: (o: { data: ArrayBuffer }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: PdfItem[] }> }> }> };
  }>;
  let pdfjs;
  try {
    pdfjs = await load(PDFJS);
  } catch {
    throw new Error("Couldn't load the PDF reader. Check your connection, or upload the script as .docx, .fdx or .txt.");
  }
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const { items } = await (await pdf.getPage(n)).getTextContent();
    let s = "";
    let lastY: number | null = null;
    for (const it of items) {
      const y = it.transform?.[5];
      if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 2 && !s.endsWith("\n")) s += "\n";
      s += it.str;
      if (it.hasEOL) s += "\n";
      if (y !== undefined) lastY = y;
    }
    // drop bare page numbers ("12." / "12") that screenplay PDFs put on each page
    pages.push(s.replace(/^\s*\d+\.?\s*$/gm, ""));
  }
  return normaliseScreenplay(pages.join("\n"));
}

/** Screenplay PDFs put the speaker on its own line above the dialogue: join them as "NAME: line" so the breakdown sees who speaks. */
function normaliseScreenplay(t: string): string {
  const lines = t.split("\n").map((l) => l.trim());
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const name = l.replace(/\s*\((V\.O\.|O\.S\.|CONT'D|O\.C\.)\)\s*$/i, "");
    const isCue = /^[A-Z][A-Z0-9 .'-]{1,30}$/.test(name) && !/^(INT|EXT|INT\/EXT|I\/E)[. ]/.test(name) && !/(CUT TO|FADE|DISSOLVE)/.test(name);
    if (isCue && lines[i + 1] && !/^[A-Z0-9 .'-]+$/.test(lines[i + 1])) {
      const said: string[] = [];
      let j = i + 1;
      while (j < lines.length && lines[j] && !/^\(.*\)$/.test(lines[j])) said.push(lines[j++]);
      while (j < lines.length && /^\(.*\)$/.test(lines[j])) j++;
      while (j < lines.length && lines[j] && !/^[A-Z][A-Z0-9 .'-]{1,30}$/.test(lines[j])) said.push(lines[j++]);
      out.push(`${name}: ${said.join(" ")}`);
      i = j - 1;
    } else out.push(l);
  }
  return out.join("\n");
}
