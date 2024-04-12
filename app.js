const md = window.markdownit({
  html: true,
  linkify: true,
  typographer: true,
});

const markdownInput = document.getElementById('markdown-input');
const markdownOutput = document.getElementById('markdown-output');
const chkSyncScroll = document.getElementById('chk-sync-scroll');

markdownInput.addEventListener('input', () => {
  const markdownText = markdownInput.value;
  const htmlText = md.render(markdownText);
  markdownOutput.innerHTML = htmlText;
});

document.getElementById('btn-reset').addEventListener('click', () => {
  markdownInput.value = '';
  markdownOutput.innerHTML = '';
});

document.getElementById('btn-copy').addEventListener('click', () => {
  markdownInput.select();
  document.execCommand('copy');
});

chkSyncScroll.addEventListener('change', () => {
  if (chkSyncScroll.checked) {
    markdownInput.addEventListener('scroll', syncScroll);
    markdownOutput.addEventListener('scroll', syncScroll);
  } else {
    markdownInput.removeEventListener('scroll', syncScroll);
    markdownOutput.removeEventListener('scroll', syncScroll);
  }
});

function syncScroll(event) {
  const target = event.target;
  const scrollValue = target.scrollTop;
  const otherElement = target === markdownInput ? markdownOutput : markdownInput;
  otherElement.scrollTop = scrollValue;
}

document.getElementById('preview-as').addEventListener('change', () => {
  const selectedOption = document.getElementById('preview-as').value;

  if (selectedOption === 'html') {
    const markdownText = markdownInput.value;
    const htmlText = md.render(markdownText);
    const paddedHtml = `<div style="padding: 50px;">${htmlText}</div>`;
    const styledHtml = paddedHtml.replace(/<img/g, '<img style="max-width: 100%; height: auto;"');
    const newWindow = window.open();
    newWindow.document.write(styledHtml);
    newWindow.document.title = 'Preview Html';
  } else if (selectedOption === 'pdf') {
    const markdownText = markdownInput.value;
    const htmlText = md.render(markdownText);
    const paddedHtml = `<div style="padding: 20px;">${htmlText}</div>`;
    const styledHtml = paddedHtml.replace(/<img/g, '<img style="max-width: 100%; height: auto;"');
    const blob = new Blob([styledHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.contentWindow.print();
  } else if (selectedOption === 'markdown') {
    const markdownText = markdownInput.value;
    const htmlText = md.render(markdownText);
    const styledMarkdown = `<div style="padding: 50px;">${htmlText.replace(/<img/g, '<img style="max-width: 100%; height: auto;"')}</div>`;
    const newWindow = window.open();
    newWindow.document.write(styledMarkdown);
    newWindow.document.title = 'Preview Markdown';
  }

  document.getElementById('preview-as').selectedIndex = 0;
});

document.getElementById('export-as').addEventListener('change', () => {
  const selectedOption = document.getElementById('export-as').value;

  if (selectedOption === 'html') {
    const markdownText = markdownInput.value;
    const htmlText = md.render(markdownText);
    const paddedHtml = `<div style="padding: 50px;">${htmlText}</div>`;
    const styledHtml = paddedHtml.replace(/<img/g, '<img style="max-width: 100%; height: auto;"');
    const blob = new Blob([styledHtml], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'exported_html.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else if (selectedOption === 'pdf') {
    const markdownText = markdownInput.value;
    const htmlText = md.render(markdownText);
    const paddedHtml = `<div style="padding: 20px;">${htmlText}</div>`;
    const styledHtml = paddedHtml.replace(/<img/g, '<img style="max-width: 100%; height: auto;"');
    const blob = new Blob([styledHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.contentWindow.print();
  } else if (selectedOption === 'markdown') {
    const markdownText = markdownInput.value;
    const blob = new Blob([markdownText], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'exported_markdown.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  document.getElementById('export-as').selectedIndex = 0;
});

document.getElementById('import').addEventListener('change', (event) => {
  const selectedOption = event.target.value;
  const turndown = new TurndownService();

  if (selectedOption === 'html') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html';

    input.onchange = (e) => {
      const file = e.target.files[0];
      const reader = new FileReader();

      reader.onload = (event) => {
        const importedHtml = event.target.result;
        const markdownText = turndown.turndown(importedHtml);
        markdownInput.value = markdownText.trim();
        const htmlText = md.render(markdownText);
        markdownOutput.innerHTML = htmlText;
      };

      reader.readAsText(file);
    };

    input.click();
  } else if (selectedOption === 'markdown') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md, .markdown';

    input.onchange = (e) => {
      const file = e.target.files[0];
      const reader = new FileReader();

      reader.onload = (event) => {
        const importedMarkdown = event.target.result;
        markdownInput.value = importedMarkdown.trim();
        const htmlText = md.render(importedMarkdown);
        markdownOutput.innerHTML = htmlText;
      };

      reader.readAsText(file);
    };

    input.click();
  }

  document.getElementById('import').selectedIndex = 0;
});

window.addEventListener('DOMContentLoaded', () => {
  const smallNavbar = document.querySelector('.small');
  const extraNavbar = document.querySelector('.extra');
  const navbarLogo = document.getElementById('navbar-logo');
  const smallLogo = document.getElementById('small-logo');

  const mediaQuery = window.matchMedia('(max-width: 1200px)');

  const handleMediaQuery = (mediaQuery) => {
    if (mediaQuery.matches) {
      smallNavbar.style.display = 'flex';
      extraNavbar.style.display = 'none';
      navbarLogo.style.display = 'none';
      smallLogo.style.display = 'inline';
    } else {
      smallNavbar.style.display = 'none';
      extraNavbar.style.display = 'flex';
      navbarLogo.style.display = 'inline';
      smallLogo.style.display = 'none';
    }
  };

  handleMediaQuery(mediaQuery);
  mediaQuery.addEventListener('change', (e) => handleMediaQuery(e.currentTarget));
});

const initialStats = {
  wordCount: 0,
  charCount: 0,
  readingTime: '0 Min Read'
};

function updateStats() {
  const text = document.getElementById('markdown-input').value;
  const stats = calculateStats(text);

  document.getElementById('reading-time-value').textContent = stats.readingTime;
  document.getElementById('word-count-value').textContent = stats.wordCount;
  document.getElementById('char-count-value').textContent = stats.charCount;
}

function calculateStats(text) {
  const words = text.split(/\s+/).filter(word => word.length > 0);
  const wordCount = words.length;
  const charCount = text.replace(/\s+/g, '').length;
  const avgReadingSpeed = 200;

  const readingTimeMinutes = Math.ceil(wordCount / avgReadingSpeed);
  const readingTime = readingTimeMinutes > 0 ? `${readingTimeMinutes} Min Read` : '0 Min Read';

  return {
    wordCount,
    charCount,
    readingTime
  };
}

document.getElementById('reading-time-value').textContent = initialStats.readingTime;
document.getElementById('word-count-value').textContent = initialStats.wordCount;
document.getElementById('char-count-value').textContent = initialStats.charCount;

document.getElementById('markdown-input').addEventListener('input', updateStats);
