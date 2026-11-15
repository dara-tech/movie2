const fs = require('fs');
const ts = require('typescript');

const content = fs.readFileSync('src/components/TVShowDetailPage.tsx', 'utf8');
const sourceFile = ts.createSourceFile('TVShowDetailPage.tsx', content, ts.ScriptTarget.Latest, true);

function visit(node) {
  if (ts.isImportDeclaration(node)) {
    console.log(node.getText(sourceFile));
  }
  ts.forEachChild(node, visit);
}

visit(sourceFile);
