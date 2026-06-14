$backendPath = "C:\Users\SA\.gemini\antigravity\brain\66c6455d-8b75-47d6-91e6-85b2e3c0fcc2\.system_generated\logs\transcript.jsonl"
$frontendPath = "C:\Users\SA\.gemini\antigravity\brain\5d5bcd04-b03b-4e6e-9e0a-7f64a3a5a595\.system_generated\logs\transcript.jsonl"

function ExtractMessage($path, $label) {
    if (Test-Path $path) {
        $lines = Get-Content $path -Encoding UTF8
        foreach ($line in $lines) {
            if ($line -like '*"name":"send_message"*') {
                try {
                    $obj = ConvertFrom-Json $line
                    foreach ($call in $obj.tool_calls) {
                        if ($call.name -eq "send_message") {
                            Write-Output "=================== $label ==================="
                            Write-Output $call.args.Message
                            Write-Output "=============================================="
                        }
                    }
                } catch {
                    # ignore
                }
            }
        }
    } else {
        Write-Output "$label path not found: $path"
    }
}

ExtractMessage $backendPath "BACKEND RESEARCH"
ExtractMessage $frontendPath "FRONTEND RESEARCH"
