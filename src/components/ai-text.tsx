import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// AI output (briefs, call teardowns, coaching) is markdown: render it instead of showing the ** and - raw.
const MD: Components = {
  p: (p) => <p className="mb-2 last:mb-0" {...p} />,
  ul: (p) => <ul className="mb-2 list-disc space-y-1 pl-5" {...p} />,
  ol: (p) => <ol className="mb-2 list-decimal space-y-1 pl-5" {...p} />,
  strong: (p) => <strong className="font-semibold" {...p} />,
  h1: (p) => <h3 className="mb-1 mt-3 text-[15px] font-semibold" {...p} />,
  h2: (p) => <h3 className="mb-1 mt-3 text-[15px] font-semibold" {...p} />,
  h3: (p) => <h4 className="mb-1 mt-2 font-medium" {...p} />,
  table: (p) => (
    <div className="overflow-x-auto">
      <table className="my-2 w-full text-xs" {...p} />
    </div>
  ),
  th: (p) => <th className="border-b px-2 py-1 text-left font-medium" {...p} />,
  td: (p) => <td className="border-b px-2 py-1" {...p} />,
  a: (p) => <a className="underline" {...p} />,
};

export function AiText({ children }: { children: string }) {
  return (
    <div className="break-words rounded-md bg-muted p-4 text-sm leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
