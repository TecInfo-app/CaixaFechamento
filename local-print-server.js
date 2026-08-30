/**
 * Servidor de Impressão Local para Terminal de Caixa
 * Como executar no seu computador:
 * 1. Instale o Node.js (https://nodejs.org)
 * 2. Salve este arquivo em uma pasta no seu computador.
 * 3. Abra o prompt de comando ou terminal nessa pasta e execute:
 *    npm install express cors
 * 4. Inicie o servidor executando:
 *    node local-print-server.js
 * 
 * O servidor rodará em http://localhost:3010 por padrão.
 */

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");

// Função para buscar o executável do navegador instalado no Windows
function getBrowserPath() {
  const commonPaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(os.homedir(), "AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"),
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    path.join(os.homedir(), "AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe")
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

// Função para converter HTML para Plain Text alinhado para bobina térmica
function htmlToPlainText(html) {
  // Remover tags script, style e links CSS que possam ter sido injetados
  let clean = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  clean = clean.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Largura máxima da bobina térmica em caracteres (padrão 40 colunas)
  const totalWidth = 40;
  
  // Converter as flex-rows (justify-between) em colunas alinhadas nas laterais
  clean = clean.replace(/<div[^>]*class="[^"]*justify-between[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, (match, inner) => {
    const columns = [];
    // Busca qualquer tag filha (geralmente span, div, p)
    const childRegex = /<[a-z0-9]+[^>]*>([\s\S]*?)<\/[a-z0-9]+>/gi;
    let m;
    while ((m = childRegex.exec(inner)) !== null) {
      let text = m[1].replace(/<[^>]+>/g, '').trim();
      if (text) {
        columns.push(text);
      }
    }
    
    if (columns.length >= 2) {
      const col1 = columns[0];
      const col2 = columns[columns.length - 1];
      const spaces = totalWidth - col1.length - col2.length;
      if (spaces > 0) {
        return col1 + " ".repeat(spaces) + col2 + "\n";
      } else {
        return col1 + " " + col2 + "\n";
      }
    } else if (columns.length === 1) {
      return columns[0] + "\n";
    }
    return match;
  });

  // Centralizar textos que tenham a classe text-center
  clean = clean.replace(/<(div|p|h[1-6])[^>]*class="[^"]*text-center[^"]*"[^>]*>([\s\S]*?)<\/\1>/gi, (match, tag, inner) => {
    let text = inner.replace(/<[^>]+>/g, '').trim();
    if (!text) return "";
    const padding = Math.max(0, Math.floor((totalWidth - text.length) / 2));
    return " ".repeat(padding) + text + "\n";
  });

  // Tratar divisores (<hr>) como linhas tracejadas
  clean = clean.replace(/<hr[^>]*class="[^"]*border-t-2[^"]*"[^>]*>/gi, "========================================\n");
  clean = clean.replace(/<hr[^>]*>/gi, "----------------------------------------\n");

  // Substituir br por quebra de linha
  clean = clean.replace(/<br\s*\/?>/gi, "\n");

  // Substituir fechamento de parágrafos e divs por quebra de linha
  clean = clean.replace(/<\/p>/gi, "\n");
  clean = clean.replace(/<\/div>/gi, "\n");

  // Remover todas as outras tags HTML restantes
  clean = clean.replace(/<[^>]+>/g, '');

  // Decodificar entidades HTML mais comuns
  clean = clean
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ordm;/g, 'º')
    .replace(/&ordf;/g, 'ª');

  // Ajustar múltiplos saltos de linha consecutivos
  const lines = clean.split(/\r?\n/).map(line => line.trimEnd());
  const finalLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === "" && finalLines[finalLines.length - 1] === "") {
      continue;
    }
    finalLines.push(line);
  }

  // Adicionar 5 saltos de linha no final para avanço do papel (guilhotina térmica)
  return finalLines.join('\n').trim() + "\n\n\n\n\n";
}

const app = express();
const PORT = 3010;

app.use(cors());
app.use(express.json({ limit: "15mb" }));

// Health Check
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Servidor de Impressão Local Ativo!" });
});

// Listar impressoras instaladas no sistema
app.get("/printers", (req, res) => {
  const isWindows = process.platform === "win32";
  const isMac = process.platform === "darwin";
  const isLinux = process.platform === "linux";

  if (isWindows) {
    // Usar PowerShell para obter a lista de impressoras de forma limpa
    const cmd = `powershell -Command "Get-CimInstance Win32_Printer | Select-Object -ExpandProperty Name"`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        // Fallback para wmic se houver erro no comando Get-CimInstance
        exec("wmic printer get name", (err2, stdout2) => {
          if (err2) {
            return res.json({ success: false, printers: [], error: err2.message });
          }
          const printers = stdout2
            .split("\r\r\n")
            .map(line => line.trim())
            .filter(line => line && line.toLowerCase() !== "name");
          return res.json({ success: true, printers });
        });
        return;
      }
      const printers = stdout
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
      res.json({ success: true, printers });
    });
  } else if (isMac || isLinux) {
    // No Unix/Linux/macOS, o utilitário lpstat é perfeito
    exec("lpstat -a | awk '{print $1}'", (error, stdout, stderr) => {
      if (error) {
        return res.json({ success: false, printers: [], error: error.message });
      }
      const printers = stdout
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
      res.json({ success: true, printers });
    });
  } else {
    res.json({ success: false, printers: [], error: "Sistema operacional não suportado." });
  }
});

// Imprimir HTML recebido
app.post("/print", (req, res) => {
  const { html, printerName } = req.body;

  if (!html) {
    return res.status(400).json({ success: false, error: "Nenhum conteúdo HTML enviado." });
  }

  console.log(`[${new Date().toLocaleTimeString()}] Nova solicitação de impressão recebida para: ${printerName || "Impressora Padrão"}`);

  const isWindows = process.platform === "win32";
  const isMac = process.platform === "darwin";
  const isLinux = process.platform === "linux";

  if (isWindows) {
    // Converter o HTML do comprovante para texto simples formatado para bobina térmica de 40 colunas
    const plainText = htmlToPlainText(html);

    // Salvar o arquivo txt temporário com codificação ISO-8859-1 (Latin-1)
    // que é a codificação nativa aceita pela imensa maioria das impressoras térmicas (evita acentos bugados!)
    const tempTxtPath = path.join(os.tmpdir(), "temp-print.txt");
    fs.writeFileSync(tempTxtPath, plainText, "latin1");

    const escapedPrinterName = printerName ? printerName.replace(/'/g, "''") : "";

    let command;
    if (!escapedPrinterName || escapedPrinterName.toLowerCase() === "padrão") {
      // Imprime na impressora padrão do Windows instantaneamente com o Bloco de Notas (/p)
      command = `notepad.exe /p "${tempTxtPath}"`;
    } else {
      // Imprime na impressora específica usando o Bloco de Notas (/pt)
      command = `notepad.exe /pt "${tempTxtPath}" "${printerName}"`;
    }

    // Executa em segundo plano para o Express responder INSTANTANEAMENTE ao navegador
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error("Erro ao imprimir via Bloco de Notas:", error);
      }
    });

    // Retorna sucesso imediatamente (latência de resposta de <5ms!)
    res.json({ success: true, message: `Enviado para a impressora [${printerName || "Padrão"}] via Bloco de Notas!` });
  } else if (isMac || isLinux) {
    // No macOS e Linux, o utilitário padrão 'lp' gerencia a fila e imprime o HTML perfeitamente.
    const dest = printerName ? `-d "${printerName}"` : "";
    const command = `lp ${dest} "${tempHtmlPath}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error("Erro ao imprimir via lp:", error);
        return res.status(500).json({ success: false, error: error.message });
      }
      res.json({ success: true, message: "Enviado para o lp/lpr com sucesso!" });
    });
  } else {
    res.status(500).json({ success: false, error: "Sistema operacional não reconhecido." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("====================================================");
  console.log(`  SERVIDOR DE IMPRESSÃO LOCAL DO TERMINAL DE CAIXA`);
  console.log(`  Endereço de escuta: http://localhost:${PORT}`);
  console.log("====================================================");
  console.log("  Instruções:");
  console.log(`  1. Certifique-se de que a impressora térmica está definida como padrão no sistema.`);
  console.log(`  2. No app web, ative a opção 'Servidor de Impressão Local' nas configurações.`);
  console.log("====================================================");
});
