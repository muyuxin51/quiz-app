const mammoth = require('mammoth');
const fs = require('fs');

async function main() {
  const file = 'C:\\Users\\Administrator\\Desktop\\软件质量测试与保证\\软件测试考试选择与判断题.docx';
  const result = await mammoth.extractRawText({ path: file });
  const lines = result.value.split('\n').map(l => l.trim());

  // Parse the entire document into question blocks (ALL content between question numbers)
  const numPattern = /^[\s]*[\(\（]?\s*(\d+)\s*[\)\）\.\、\．\s]+/;
  const optPattern = /^([A-Da-d])[\.\、\)\s]\s*(.+)/;
  const itemPattern = /^[①②③④⑤⑥⑦⑧⑨⑩]/;
  const tfAnswerPattern = /[（(]\s*([×√])\s*[）)]/;
  const mcqAnswerPattern = /[（(]\s*([A-Da-d])\s*[）)]/;

  let questions = [];
  let current = null;
  let inTF = false;

  function saveCurrent() {
    if (!current) return;
    const hasAnswer = current.answer && ((current.type === 'mcq' && current.options.length >= 2) || current.type === 'tf');
    if (hasAnswer) questions.push(current);
    current = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    if (/^二[、.]\s*判断/.test(line)) { saveCurrent(); inTF = true; continue; }
    if (/^三[、.]\s*选择/.test(line) || /^[一二三四五六七八九十]+[、.]/.test(line)) { saveCurrent(); inTF = false; continue; }

    const numMatch = line.match(numPattern);
    if (numMatch) {
      saveCurrent();
      let body = line.replace(numPattern, '').trim();
      if (!body) continue;

      let answer = null;
      let type = 'mcq';

      if (inTF || tfAnswerPattern.test(body)) {
        const m = body.match(tfAnswerPattern);
        answer = m ? m[1] : null;
        type = 'tf';
      } else {
        const m = body.match(mcqAnswerPattern);
        answer = m ? m[1].toUpperCase() : null;
      }

      let display = body;
      display = display.replace(/[（(]\s*[×√A-Da-d]\s*[）)]/g, '（  ）');

      current = {
        type: type, original: body, display: display,
        answer: answer, options: [], extraLines: [], codeLines: []
      };
      continue;
    }

    if (!current) continue;

    // Collect ALL non-option, non-answer content between question and next question
    if (current.type === 'mcq') {
      const optMatch = line.match(optPattern);
      if (optMatch && optMatch[2]) {
        current.options.push({ letter: optMatch[1].toUpperCase(), text: optMatch[2].trim() });
        continue;
      }
    }

    // Item lines (①②③④)
    if (itemPattern.test(line)) {
      current.extraLines.push(line);
      continue;
    }

    // Code-looking lines
    if (/^[a-zA-Z#<\(\{\[\/\s]/.test(line) && !/[，。！？、；：""''（）《》【】\u4e00-\u9fff]/.test(line) && line.length > 3) {
      if (!optPattern.test(line)) {
        current.codeLines.push(line);
        continue;
      }
    }
  }
  saveCurrent();

  // Merge extraLines and codeLines into original/display
  for (const q of questions) {
    const additions = [];
    if (q.codeLines.length > 0) additions.push('```\n' + q.codeLines.join('\n') + '\n```');
    if (q.extraLines.length > 0) additions.push(q.extraLines.join('\n'));
    if (additions.length > 0) {
      if (q.codeLines.length > 0) q.original += '\n' + q.codeLines.join('\n');
      if (q.extraLines.length > 0) q.original += '\n' + q.extraLines.join('\n');
      q.display += '\n' + additions.join('\n');
    }
    delete q.codeLines; delete q.extraLines;
  }

  console.log('Parsed:', questions.length, 'questions');
  const withItems = questions.filter(q => /[①②③④⑤⑥]/.test(q.display.split('\n').slice(1).join('')));
  console.log('With items:', withItems.length);

  // Now match with existing bank data and update display
  const banks = JSON.parse(fs.readFileSync('banks.json', 'utf-8'));
  const existing = banks[0].questions;

  let updated = 0;
  for (const q of questions) {
    for (const eq of existing) {
      if (eq.type === q.type && eq.original.substring(0, 25) === q.original.substring(0, 25)) {
        // Update display to include items/code
        if (q.display !== eq.display && (q.display.includes('```') || q.display.includes('\n①'))) {
          eq.display = q.display;
          eq.original = q.original;
          if (q.options.length > eq.options.length) eq.options = q.options;
          updated++;
        }
        break;
      }
    }
  }
  console.log('Updated:', updated, 'questions');

  fs.writeFileSync('banks.json', JSON.stringify(banks), 'utf-8');
}

main().catch(console.error);
