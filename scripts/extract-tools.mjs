#!/usr/bin/env node
// Extract {name, description} for every server.registerTool(...) call in a server's
// src/index.ts, plus the two shared license tools from @theluckystrike/mcp-license
// (license_status, license_activate), which every server registers via gate.registerTools(server).
// Usage: node extract-tools.mjs <path/to/src/index.ts> <path/to/mcp-license/dist/index.js>
// Prints JSON array [{name, description}, ...] to stdout.

import fs from "node:fs";
import ts from "typescript";

const [, , indexTsPath, licenseDistPath] = process.argv;

function extractFromRegisterTool(sourcePath) {
  const src = fs.readFileSync(sourcePath, "utf8");
  const sf = ts.createSourceFile(sourcePath, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const tools = [];

  // Resolve simple top-level `const NAME = <literal>;` so template substitutions
  // like `${DROP_ALERT_PCT}` can be inlined into the manifest description.
  const constMap = new Map();
  for (const stmt of sf.statements) {
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer) {
          if (ts.isNumericLiteral(decl.initializer)) {
            constMap.set(decl.name.text, decl.initializer.text);
          } else if (ts.isStringLiteral(decl.initializer)) {
            constMap.set(decl.name.text, decl.initializer.text);
          }
        }
      }
    }
  }

  function stringLiteralText(node) {
    if (!node) return undefined;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isTemplateExpression(node)) {
      let out = node.head.text;
      for (const span of node.templateSpans) {
        const expr = span.expression;
        let resolved;
        if (ts.isIdentifier(expr) && constMap.has(expr.text)) {
          resolved = constMap.get(expr.text);
        } else {
          resolved = expr.getText(sf);
        }
        out += resolved + span.literal.text;
      }
      return out;
    }
    if (ts.isBinaryExpression(node)) {
      // string concatenation: "a" + "b"
      const l = stringLiteralText(node.left);
      const r = stringLiteralText(node.right);
      if (l !== undefined && r !== undefined) return l + r;
    }
    if (ts.isParenthesizedExpression(node)) return stringLiteralText(node.expression);
    return undefined;
  }

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "registerTool"
    ) {
      const args = node.arguments;
      let name;
      let configObj;
      if (args.length >= 1 && (ts.isStringLiteral(args[0]) || ts.isNoSubstitutionTemplateLiteral(args[0]))) {
        name = args[0].text;
        if (args.length >= 2 && ts.isObjectLiteralExpression(args[1])) configObj = args[1];
      }
      if (name && configObj) {
        let description = "";
        for (const prop of configObj.properties) {
          if (
            ts.isPropertyAssignment(prop) &&
            ts.isIdentifier(prop.name) &&
            prop.name.text === "description"
          ) {
            description = stringLiteralText(prop.initializer) ?? "";
          }
        }
        tools.push({ name, description });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return tools;
}

function extractLicenseTools(licenseDistJsPath) {
  // The shared gate registers exactly these two tools (verified against
  // packages/mcp-license/dist/index.js registerTools()); parse it defensively
  // in case the shared package changes.
  const src = fs.readFileSync(licenseDistJsPath, "utf8");
  const results = [];
  const re = /registerTool\(\s*"([^"]+)"\s*,\s*\{\s*title:\s*"([^"]*)"\s*,\s*description:\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(src))) {
    results.push({ name: m[1], description: m[3].replace(/\\"/g, '"') });
  }
  return results;
}

const tools = [
  ...extractFromRegisterTool(indexTsPath),
  ...extractLicenseTools(licenseDistPath),
];

process.stdout.write(JSON.stringify(tools));
