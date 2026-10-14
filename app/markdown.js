'use strict';

// ---------------------------------------------------------------
// docs/ の Markdown を画面で読めるようにする、ごく小さな変換器
// 対応: 見出し、段落、箇条書き、番号付きリスト、引用、表、コードブロック、
//       インラインコード、強調、リンク、画像
// ---------------------------------------------------------------

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// docs/ 内の相対リンクをアプリ内の URL に直す（spec.md -> /docs/spec、images/x.png -> /docs/images/x.png）
function docUrl(target) {
  if (/^[a-z]+:/.test(target) || target.startsWith('/') || target.startsWith('#')) return target;
  const [path, hash] = target.split('#');
  if (path.endsWith('.md')) return `/docs/${path.slice(0, -3)}${hash ? '#' + hash : ''}`;
  return `/docs/${path}`;
}

function inline(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => `<img src="${docUrl(src)}" alt="${alt}">`);
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => `<a href="${docUrl(href)}">${label}</a>`);
  html = html.replace(/&lt;(https?:\/\/[^&]+)&gt;/g, '<a href="$1">$1</a>');
  return html;
}

function tableRow(line, tag) {
  const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
  return `<tr>${cells.map((c) => `<${tag}>${inline(c.trim())}</${tag}>`).join('')}</tr>`;
}

function render(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      i++;
      out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }
    if (/^\s*\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      const [head, , ...body] = rows;
      out.push(`<table class="table"><thead>${tableRow(head, 'th')}</thead><tbody>${body.map((r) => tableRow(r, 'td')).join('')}</tbody></table>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items = [];
      while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) {
        if (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''));
        } else {
          items[items.length - 1] += ' ' + lines[i].trim();
        }
        i++;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</${tag}>`);
      continue;
    }
    if (line.startsWith('>')) {
      const quote = [];
      while (i < lines.length && lines[i].startsWith('>')) quote.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`);
      continue;
    }
    if (line.trim() === '') {
      i++;
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,4}\s|```|\s*\||\s*[-*]\s|\s*\d+\.\s|>)/.test(lines[i])) {
      para.push(lines[i++]);
    }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

module.exports = { render };
