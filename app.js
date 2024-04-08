const md = window.markdownit({
  html: true,
  linkify: true,
  typographer: true,
});

const markdownInput = document.getElementById("markdown-input");
const markdownOutput = document.getElementById("markdown-output");

markdownInput.addEventListener("input", () => {
  const markdownText = markdownInput.value;
  const htmlText = md.render(markdownText);
  markdownOutput.innerHTML = htmlText;
});
