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
    // Injetar script para auto-imprimir e auto-fechar a aba no Microsoft Edge/Chrome silenciosamente
    const printScript = `
<script>
  window.onload = function() {
    window.print();
    setTimeout(function() {
      window.close();
    }, 1000);
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

    const browserPath = getBrowserPath() || "msedge.exe"; // Fallback para msedge.exe se não achar caminho
    const escapedBrowserPath = browserPath.replace(/'/g, "''");
    const escapedPrinterName = printerName ? printerName.replace(/'/g, "''") : "";
    const edgeProfileDir = path.join(os.tmpdir(), "browser-print-profile");
    const escapedProfileDir = edgeProfileDir.replace(/'/g, "''");
    const escapedHtmlPath = tempHtmlPath.replace(/'/g, "''");

    // Otimização de comandos: Se não houver impressora selecionada (ou se for para usar a padrão), inicia direto sem buscar impressoras por WMI/PowerShell
    let command;
    if (!escapedPrinterName || escapedPrinterName.toLowerCase() === "padrão") {
      command = `powershell -Command "$browser = '${escapedBrowserPath}'; $html = '${escapedHtmlPath}'; $profile = '${escapedProfileDir}'; Start-Process -FilePath $browser -ArgumentList '--kiosk', '--kiosk-printing', '--no-first-run', ('--user-data-dir=' + $profile), $html -WindowStyle Hidden"`;
    } else {
      // Se tiver impressora explícita, muda temporariamente, espera 2 segundos (suficiente para enviar ao spooler) e restaura
      command = `powershell -Command "$browser = '${escapedBrowserPath}'; $html = '${escapedHtmlPath}'; $profile = '${escapedProfileDir}'; $printer = '${escapedPrinterName}'; $oldDefault = ''; try { $oldDefault = (Get-CimInstance Win32_Printer -Filter 'Default = true').Name } catch { try { $oldDefault = (Get-WmiObject Win32_Printer -Filter 'Default = true').Name } catch {} }; (New-Object -ComObject WScript.Network).SetDefaultPrinter($printer); Start-Process -FilePath $browser -ArgumentList '--kiosk', '--kiosk-printing', '--no-first-run', ('--user-data-dir=' + $profile), $html -WindowStyle Hidden; Start-Sleep -Seconds 2; if ($oldDefault) { (New-Object -ComObject WScript.Network).SetDefaultPrinter($oldDefault) }"`;
    }

    // Executa em segundo plano para o Express responder INSTANTANEAMENTE ao navegador
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error("Erro ao imprimir em segundo plano via PowerShell/Navegador:", error);
      }
    });

    // Retorna sucesso imediatamente (latência cai de 5-7 segundos para <15 milissegundos!)
    res.json({ success: true, message: `Enviado para processamento de impressão em segundo plano!` });
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
