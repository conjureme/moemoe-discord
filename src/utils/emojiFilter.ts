export function removeUnicodeEmojis(text: string): string {
  // unicode emoji regex pattern
  const emojiRegex =
    /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1FA70}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F170}-\u{1F251}]/gu;

  // additional patterns for emoji modifiers and zero-width joiners
  const emojiModifierRegex = /[\u{1F3FB}-\u{1F3FF}]/gu;
  const zeroWidthJoinerRegex = /\u{200D}/gu;

  let filtered = text.replace(emojiRegex, '');
  filtered = filtered.replace(emojiModifierRegex, '');
  filtered = filtered.replace(zeroWidthJoinerRegex, '');

  filtered = filtered.replace(/\s{2,}/g, ' ').trim();

  return filtered;
}

export function containsUnicodeEmoji(text: string): boolean {
  const emojiRegex =
    /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1FA70}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F170}-\u{1F251}]/gu;

  return emojiRegex.test(text);
}

// preserve discord custom emojis (format: <:name:id> or <a:name:id> for animated)
export function isDiscordCustomEmoji(text: string): boolean {
  const customEmojiRegex = /<a?:\w+:\d+>/g;
  return customEmojiRegex.test(text);
}
