function Search-Manifest ($path) {
    try {
        $files = Get-ChildItem -Path $path -Filter "AndroidManifest.xml" -ErrorAction SilentlyContinue
        if ($files) {
            foreach ($file in $files) {
                Write-Output $file.FullName
            }
        }
        $dirs = Get-ChildItem -Path $path -Directory -ErrorAction SilentlyContinue
        foreach ($dir in $dirs) {
            if ($dir.Name -notmatch "node_modules|\.gradle|\.git|AppData|Local|Roaming|Cache") {
                Search-Manifest $dir.FullName
            }
        }
    } catch {}
}

Search-Manifest "C:\Users\ASUS"
Search-Manifest "C:\Projects"
Search-Manifest "C:\src"
