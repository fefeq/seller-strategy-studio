import { describe, expect, it } from "vitest";
import { cleanText, driveErrorText, driveIdFromUrl, driveQ, kindLabel, markdownToHtml, planMarkdown, readPlan, safeName } from "./drive";

describe("driveIdFromUrl", () => {
  it("reads files, docs, sheets, slides, folders and open?id links", () => {
    expect(driveIdFromUrl("https://drive.google.com/file/d/1AbCdEfGhIjK_lm-no/view?usp=sharing")).toBe("1AbCdEfGhIjK_lm-no");
    expect(driveIdFromUrl("https://docs.google.com/document/d/16BlvxrFxHDtyjuu/edit")).toBe("16BlvxrFxHDtyjuu");
    expect(driveIdFromUrl("https://docs.google.com/spreadsheets/d/1SheetIdXYZ123/edit#gid=0")).toBe("1SheetIdXYZ123");
    expect(driveIdFromUrl("https://docs.google.com/presentation/d/1SlidesIdXYZ/edit")).toBe("1SlidesIdXYZ");
    expect(driveIdFromUrl("https://drive.google.com/drive/folders/18or3hv4WD9Fd1DB1uZx")).toBe("18or3hv4WD9Fd1DB1uZx");
    expect(driveIdFromUrl("https://drive.google.com/open?id=1OpenIdABCDEF")).toBe("1OpenIdABCDEF");
    expect(driveIdFromUrl("18or3hv4WD9Fd1DB1uZx")).toBe("18or3hv4WD9Fd1DB1uZx");
  });
  it("refuses other sites and junk", () => {
    expect(driveIdFromUrl("https://evil.com/file/d/1AbCdEfGhIjK/view")).toBeNull();
    expect(driveIdFromUrl("hola")).toBeNull();
    expect(driveIdFromUrl("")).toBeNull();
  });
});

describe("readPlan", () => {
  it("exports Google files, sends PDFs to the AI, converts Office files and skips images", () => {
    expect(readPlan("application/vnd.google-apps.document")).toEqual({ kind: "export", mime: "text/markdown", fallback: "text/plain" });
    expect(readPlan("application/vnd.google-apps.spreadsheet")).toEqual({ kind: "export", mime: "text/csv" });
    expect(readPlan("application/pdf")).toEqual({ kind: "pdf" });
    expect(readPlan("text/csv")).toEqual({ kind: "text" });
    expect(readPlan("application/vnd.openxmlformats-officedocument.wordprocessingml.document")?.kind).toBe("convert");
    expect(readPlan("image/png")).toBeNull();
  });
});

describe("texts", () => {
  it("labels kinds, escapes queries, cleans exports and names", () => {
    expect(kindLabel("application/vnd.google-apps.folder")).toBe("Carpeta");
    expect(kindLabel("application/pdf")).toBe("PDF");
    expect(driveQ("O'Neil")).toBe("O\\'Neil");
    expect(cleanText("\uFEFFHola\r\n\r\n\r\n\r\nmundo")).toEqual({ text: "Hola\n\nmundo", truncated: false });
    expect(cleanText("# **Plan**\n\n\\_nota\\_").text).toBe("# Plan\n\n_nota_");
    expect(cleanText("abcdef", 3)).toEqual({ text: "abc…", truncated: true });
    expect(safeName(" Acme / Iberia\n ")).toBe("Acme Iberia");
    expect(safeName("  ")).toBe("Sin título");
  });
  it("explains Drive errors in Spanish", () => {
    expect(driveErrorText(404)).toMatch(/No encuentro/);
    expect(driveErrorText(403, "insufficientPermissions")).toMatch(/permisos/);
    expect(driveErrorText(401)).toMatch(/caducado/);
  });
});

describe("markdownToHtml", () => {
  it("turns headings, lists, bold and links into HTML and escapes the rest", () => {
    const html = markdownToHtml("# Título\n\nTexto **clave** y [web](https://acme.com)\n\n- uno\n- dos\n\n1. a\n2. b\n\n<script>");
    expect(html).toContain("<h1>Título</h1>");
    expect(html).toContain("<b>clave</b>");
    expect(markdownToHtml("_Exportado hoy_")).toContain("<i>Exportado hoy</i>");
    expect(markdownToHtml("snake_case_name")).not.toContain("<i>");
    expect(html).toContain('<a href="https://acme.com">web</a>');
    expect(html).toContain("<ul><li>uno</li><li>dos</li></ul>");
    expect(html).toContain("<ol><li>a</li><li>b</li></ol>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});

describe("planMarkdown", () => {
  it("keeps only the filled fields", () => {
    const md = planMarkdown("Acme", [["Dolores", "Lento"], ["Riesgos", " "], ["Competencia", null]], new Date("2026-10-23T12:00:00Z"));
    expect(md).toContain("# Plan de cuenta · Acme");
    expect(md).toContain("## Dolores\n\nLento");
    expect(md).not.toContain("Riesgos");
    expect(md).not.toContain("Competencia");
  });
});
