const md = window.markdownit({
    html: true,
    linkify: true,
    typographer: true,
  });
  
  const markdownInput = document.getElementById('markdown-input');
  const markdownOutput = document.getElementById('markdown-output');
  
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
  
  document.getElementById('btn-sync-scroll').addEventListener('click', () => {
    markdownInput.addEventListener('scroll', () => {
      markdownOutput.scrollTop = markdownInput.scrollTop;
    });
  });
  
  document.getElementById('preview-as').addEventListener('change', () => {
    const selectedOption = document.getElementById('preview-as').value;
  });
  
  document.getElementById('export-as').addEventListener('change', () => {
    const selectedOption = document.getElementById('export-as').value;
    if (selectedOption === 'html') 
    {
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
    } 
    else if (selectedOption === 'pdf') 
    {
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
    } 
    else if (selectedOption === 'markdown') 
    {
        const markdownText = markdownInput.value;
        const blob = new Blob([markdownText], { type: 'text/markdown' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'exported_markdown.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
  });
  
  document.getElementById('import').addEventListener('change', () => {
    const selectedOption = document.getElementById('import').value;
  });
  