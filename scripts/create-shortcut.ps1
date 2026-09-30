Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$assetsDir = Join-Path $projectRoot 'public'
New-Item -ItemType Directory -Path $assetsDir -Force | Out-Null
$icoPath = Join-Path $assetsDir 'app-icon.ico'

function New-IconBitmap([int]$size) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    $pad = [int]($size * 0.04)
    $box = $size - (2 * $pad)
    $radius = [int]($size * 0.22)

    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($pad, $pad, $radius, $radius, 180, 90)
    $path.AddArc(($pad + $box - $radius), $pad, $radius, $radius, 270, 90)
    $path.AddArc(($pad + $box - $radius), ($pad + $box - $radius), $radius, $radius, 0, 90)
    $path.AddArc($pad, ($pad + $box - $radius), $radius, $radius, 90, 90)
    $path.CloseFigure()

    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point 0, 0),
        (New-Object System.Drawing.Point $size, $size),
        [System.Drawing.Color]::FromArgb(255, 76, 79, 214),
        [System.Drawing.Color]::FromArgb(255, 51, 54, 143)
    )
    $g.FillPath($brush, $path)

    # White cheque slip with ruled lines, sized relative to the canvas.
    $cx = $size * 0.18
    $cy = $size * 0.32
    $cw = $size * 0.64
    $ch = $size * 0.36
    $g.FillRectangle([System.Drawing.Brushes]::White, $cx, $cy, $cw, $ch)

    $linePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 150, 155, 200)), ([single]($size * 0.018))
    $g.DrawLine($linePen, ($cx + $cw * 0.10), ($cy + $ch * 0.34), ($cx + $cw * 0.72), ($cy + $ch * 0.34))
    $g.DrawLine($linePen, ($cx + $cw * 0.10), ($cy + $ch * 0.60), ($cx + $cw * 0.55), ($cy + $ch * 0.60))

    $accent = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 0, 184, 169))
    $g.FillRectangle($accent, ($cx + $cw * 0.10), ($cy + $ch * 0.12), ($cw * 0.34), ($ch * 0.12))

    $linePen.Dispose()
    $accent.Dispose()
    $brush.Dispose()
    $path.Dispose()
    $g.Dispose()
    return $bmp
}

# Multi-resolution .ico written by hand; System.Drawing.Icon.Save only emits a single size.
$sizes = @(16, 32, 48, 64, 128, 256)
$pngs = @()
foreach ($s in $sizes) {
    $bmp = New-IconBitmap $s
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngs += , $ms.ToArray()
    $ms.Dispose()
    $bmp.Dispose()
}

$fs = [System.IO.File]::Create($icoPath)
$bw = New-Object System.IO.BinaryWriter $fs
$bw.Write([UInt16]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]$sizes.Count)

$offset = 6 + (16 * $sizes.Count)
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $dim = if ($sizes[$i] -ge 256) { 0 } else { $sizes[$i] }
    $bw.Write([Byte]$dim)
    $bw.Write([Byte]$dim)
    $bw.Write([Byte]0)
    $bw.Write([Byte]0)
    $bw.Write([UInt16]1)
    $bw.Write([UInt16]32)
    $bw.Write([UInt32]$pngs[$i].Length)
    $bw.Write([UInt32]$offset)
    $offset += $pngs[$i].Length
}
foreach ($png in $pngs) { $bw.Write($png) }
$bw.Flush()
$bw.Close()
$fs.Close()

$launcher = Join-Path $PSScriptRoot 'start-app.ps1'
$desktop = [Environment]::GetFolderPath('Desktop')
$finalPath = Join-Path $desktop 'برنامج الشيكات.lnk'

# WScript.Shell mangles non-ASCII paths, so build under an ASCII name and rename after.
$tempPath = Join-Path $desktop '__cheque-printer-shortcut.lnk'
if (Test-Path $tempPath) { Remove-Item $tempPath -Force }

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($tempPath)
$shortcut.TargetPath = 'powershell.exe'
$shortcut.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcher`""
$shortcut.WorkingDirectory = $projectRoot
$shortcut.IconLocation = "$icoPath,0"
$shortcut.Description = 'Cheque Printer'
$shortcut.Save()

if (Test-Path $finalPath) { Remove-Item $finalPath -Force }
[System.IO.File]::Move($tempPath, $finalPath)

Write-Host "تم إنشاء الأيقونة: $icoPath"
Write-Host "تم إنشاء الاختصار على سطح المكتب: $finalPath"
