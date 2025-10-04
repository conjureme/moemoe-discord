export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class PlaceholderValidator {
  static validate(text: string): ValidationResult {
    const errors: string[] = [];

    const placeholderPattern = /(?<!\\)\{[^}]+\}|(?<!\\)\[[^\]]+\]/g;
    const matches = text.match(placeholderPattern) || [];

    for (const match of matches) {
      const error = this.validateSinglePlaceholder(match);
      if (error) {
        errors.push(error);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private static validateSinglePlaceholder(placeholder: string): string | null {
    if (placeholder.startsWith('{embed')) {
      return this.validateEmbed(placeholder);
    }

    if (placeholder.startsWith('{range:')) {
      return this.validateRange(placeholder);
    }

    if (placeholder.startsWith('{modifybal:')) {
      return this.validateModifyBal(placeholder);
    }

    if (placeholder.startsWith('{generate_response:')) {
      return this.validateGenerateResponse(placeholder);
    }

    if (
      placeholder.startsWith('{cooldown:') ||
      placeholder.startsWith('{react:') ||
      placeholder.startsWith('{reactreply:')
    ) {
      return this.validateAction(placeholder);
    }

    if (placeholder.startsWith('{sendto:')) {
      return this.validateSendTo(placeholder);
    }

    if (placeholder.match(/^\{user/i)) {
      return this.validateUser(placeholder);
    }

    return null;
  }

  private static validateEmbed(placeholder: string): string | null {
    if (placeholder === '{embed}') {
      return null;
    }

    const match = placeholder.match(/^\{embed:([^}]+)\}$/i);
    if (!match) {
      return `invalid embed syntax: ${placeholder}. expected {embed} or {embed:name}`;
    }

    const embedName = match[1];
    if (!embedName || embedName.trim() === '') {
      return `embed name cannot be empty: ${placeholder}`;
    }

    return null;
  }

  private static validateRange(placeholder: string): string | null {
    const match = placeholder.match(/^\{range:(\d+)-(\d+)\}$/i);
    if (!match) {
      return `invalid range syntax: ${placeholder}. expected format: {range:min-max}`;
    }

    const min = parseInt(match[1]);
    const max = parseInt(match[2]);

    if (isNaN(min) || isNaN(max)) {
      return `range values must be valid integers: ${placeholder}`;
    }

    if (min < 0 || max < 0) {
      return `range values cannot be negative: ${placeholder}`;
    }

    if (min > max) {
      return `range minimum (${min}) cannot be greater than maximum (${max}): ${placeholder}`;
    }

    return null;
  }

  private static validateModifyBal(placeholder: string): string | null {
    const match = placeholder.match(
      /^\{modifybal:([\+\-=])(\[range\]|\d+)\}$/i
    );
    if (!match) {
      return `invalid modifybal syntax: ${placeholder}. expected format: {modifybal:+amount}, {modifybal:-amount}, {modifybal:=amount}, or {modifybal:+[range]}`;
    }

    const value = match[2];

    if (value !== '[range]') {
      const amount = parseInt(value);
      if (isNaN(amount)) {
        return `modifybal amount must be a valid integer: ${placeholder}`;
      }
    }

    return null;
  }

  private static validateGenerateResponse(placeholder: string): string | null {
    const match = placeholder.match(/^\{generate_response:([^}]+)\}$/i);
    if (!match) {
      return `invalid generate_response syntax: ${placeholder}`;
    }

    const prompt = match[1];
    if (!prompt || prompt.trim() === '') {
      return `generate_response prompt cannot be empty: ${placeholder}`;
    }

    return null;
  }

  private static validateAction(placeholder: string): string | null {
    const match = placeholder.match(
      /^\{(cooldown|react|reactreply):([^}]+)\}$/i
    );
    if (!match) {
      return `invalid action syntax: ${placeholder}`;
    }

    const value = match[2];
    if (!value || value.trim() === '') {
      return `${match[1]} value cannot be empty: ${placeholder}`;
    }

    if (match[1] === 'cooldown') {
      const seconds = parseInt(value);
      if (isNaN(seconds) || seconds < 0) {
        return `cooldown value must be a positive integer: ${placeholder}`;
      }
    }

    return null;
  }

  private static validateSendTo(placeholder: string): string | null {
    const match = placeholder.match(/^\{sendto:([^}]+)\}$/i);
    if (!match) {
      return `invalid sendto syntax: ${placeholder}`;
    }

    const channelId = match[1];
    if (!channelId || channelId.trim() === '') {
      return `sendto channel id cannot be empty: ${placeholder}`;
    }

    if (!/^\d+$/.test(channelId)) {
      return `sendto channel id must be numeric: ${placeholder}`;
    }

    return null;
  }

  private static validateUser(placeholder: string): string | null {
    const match = placeholder.match(/^\{user[^}]*:([^}]+)\}$/i);

    if (match) {
      const userId = match[1];
      if (!/^\d+$/.test(userId)) {
        return `user id must be numeric: ${placeholder}`;
      }
    }

    return null;
  }

  static getErrorMessage(result: ValidationResult): string {
    if (result.valid) return '';
    return `a placeholder value was used wrong:\n${result.errors.map((e) => `- ${e}`).join('\n')}`;
  }

  static hasPlaceholders(text: string): boolean {
    const placeholderPattern = /(?<!\\)\{[^}]+\}|(?<!\\)\[[^\]]+\]/g;
    return placeholderPattern.test(text);
  }
}
