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
    // Injetar script para auto-imprimir e auto-fechar a aba no Microsoft Edge silenciosamente
    const printScript = `
<script>
  window.onload = function() {
    window.print();
    setTimeout(function() {
      window.close();
    }, 1500);
  };
</script>
`;
    let finalHtml = html;
    if (finalHtml.includes("</body>")) {
      finalHtml = finalHtml.replace("</body>", `${printScript}</body>`);
    } else {
      finalHtml = finalHtml + printScript;
    }

    // Criar arquivo HTML temporário no diretório temporário do sistema operacional
    const tempHtmlPath = path.join(os.tmpdir(), "temp-print.html");
    fs.writeFileSync(tempHtmlPath, finalHtml, "utf8");

    // No Windows, usamos o Microsoft Edge em modo de quiosque silencioso (--kiosk-printing)
    // para enviar a impressão sem janelas de visualização.
    // Mudamos temporariamente a impressora padrão se o usuário selecionou uma.
    const escapedPrinterName = printerName ? printerName.replace(/'/g, "''") : "";
    const edgeProfileDir = path.join(os.tmpdir(), "edge-print-profile").replace(/\\/g, "\\\\");
    const cleanTempHtmlPath = tempHtmlPath.replace(/\\/g, "\\\\");

    let command;
    if (escapedPrinterName) {
      command = `powershell -Command "$oldDefault = ''; try { $oldDefault = (Get-CimInstance Win32_Printer -Filter 'Default = true').Name } catch { try { $oldDefault = (Get-WmiObject Win32_Printer -Filter 'Default = true').Name } catch {} }; (New-Object -ComObject WScript.Network).SetDefaultPrinter('${escapedPrinterName}'); Start-Process 'msedge.exe' -ArgumentList '--kiosk', '--kiosk-printing', '--no-first-run', '--user-data-dir=\\"${edgeProfileDir}\\"', '\\"${cleanTempHtmlPath}\\"' -WindowStyle Hidden; Start-Sleep -Seconds 4; if ($oldDefault) { (New-Object -ComObject WScript.Network).SetDefaultPrinter($oldDefault) }"`;
    } else {
      command = `powershell -Command "Start-Process 'msedge.exe' -ArgumentList '--kiosk', '--kiosk-printing', '--no-first-run', '--user-data-dir=\\"${edgeProfileDir}\\"', '\\"${cleanTempHtmlPath}\\"' -WindowStyle Hidden"`;
    }
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error("Erro ao imprimir via PowerShell/Edge:", error);
        return res.status(500).json({ success: false, error: error.message });
      }
      res.json({ success: true, message: `Enviado para a fila de impressão [${printerName || "Padrão"}] do Windows!` });
    });
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
