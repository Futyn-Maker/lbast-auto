const TG_LIMIT = 4096;

export function chunkText(text, limit = TG_LIMIT) {
  const chunks = [];
  let remaining = String(text);
  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf("\n", limit);
    if (cut <= 0) {
      cut = limit;
    }
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).replace(/^\n/, "");
  }
  chunks.push(remaining);
  return chunks;
}

export async function sendChunked(api, chatId, text, extra = {}) {
  const chunks = chunkText(text);
  for (const chunk of chunks) {
    if (chunk.length === 0) {
      continue;
    }
    await api.sendMessage(chatId, chunk, extra);
  }
}

export function levelerPrefix(leveler) {
  const login = leveler.Character
    ? leveler.Character.login
    : leveler.characterLogin || "?";
  return `[${leveler.name} / ${login}]`;
}
