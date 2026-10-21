import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// AI output (briefs, call teardowns, coaching) is markdown: render it instead of showing the ** and - raw.
const MD = {
  p: (p: any) => <p className="mb-2 last:mb-0" {...p} />,
  ul: (p: any) => <ul className="mb-2 list-disc space-y-1 pl-5" {...p} />,
  ol: (p: any) => <ol className="mb-2 list-decimal space-y-1 pl-5" {...p} />,
  strong: (p: any) => <strong className="font-semibold" {...p} />,
  h1: (p: any) => <h3 className="mb-1 mt-3 text-[15px] font-semibold" {...p} />,
  h2: (p: any) => <h3 className="mb-1 mt-3 text-[15px] font-semibold" {...p} />,
  h3: (p: any) => <h4 className="mb-1 mt-2 font-medium" {...p} />,
  table: (p: any) => <div className="overflow-x-auto"><table className="my-2 w-full text-xs" {...p} /></div>,
  th: (p: any) => <th className="border-b px-2 py-1 text-left font-medium" {...p} />,
  td: (p: any) => <td className="border-b px-2 py-1" {...p} />,
  a: (p: any) => <a className="underline" {...p} />,
};

export function AiText({ children }: { children: string }) {
  return (
    <div className="break-words rounded-md bg-muted p-4 text-sm leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>{children}</ReactMarkdown>
    </div>
  );
}
