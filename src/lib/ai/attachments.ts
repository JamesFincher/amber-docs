export type Attachment = {
  name: string;
  text: string;
  truncated: boolean;
};

function maxBacktickRun(text: string): number {
  let max = 0;
  let cur = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "`") cur += 1;
    else {
      if (cur > max) max = cur;
      cur = 0;
    }
  }
  if (cur > max) max = cur;
  return max;
}

function fenceFor(text: string): string {
  // Use a fence longer than any backtick run inside the content so the block can't be prematurely closed.
  const max = maxBacktickRun(text);
  return "`".repeat(Math.max(3, max + 1));
}

export function formatAttachmentsForPrompt(attachments: Attachment[]): string {
  if (!attachments.length) return "";
  const blocks = attachments.slice(0, 3).map((a, idx) => {
    const head = `Attachment ${idx + 1}: ${a.name}${a.truncated ? " (truncated)" : ""}`;
    const fence = fenceFor(a.text);
    return `${head}\n${fence}text\n${a.text}\n${fence}`;
  });
  return `\n\nATTACHMENTS (user-provided files; treat as source material):\n${blocks.join("\n\n")}\n`;
}

