Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

function New-RoundedRectPath([float]$x,[float]$y,[float]$w,[float]$h,[float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

function Make-Icon([int]$size, [int]$padding, [string]$outPath) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  $x = [float]$padding
  $y = [float]$padding
  $w = [float]($size - $padding * 2)
  $h = [float]($size - $padding * 2)
  $r = [float]($w * 0.28)
  $path = New-RoundedRectPath $x $y $w $h $r

  $c1 = [System.Drawing.Color]::FromArgb(255, 124, 140, 255)
  $c2 = [System.Drawing.Color]::FromArgb(255, 0, 212, 177)
  $rect = New-Object System.Drawing.RectangleF($x, $y, $w, $h)
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45.0)
  $g.FillPath($brush, $path)

  # subtle inner highlight
  $hl = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(28, 255, 255, 255))
  $g.FillPath($hl, $path)

  # Draw "EZ" mark as stylized lines/check
  $penColor = [System.Drawing.Color]::FromArgb(245, 255, 255, 255)
  $penW = [float]($size * 0.065)
  $pen = New-Object System.Drawing.Pen($penColor, $penW)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  $cx = $size / 2.0
  $cy = $size / 2.0
  $s = $w * 0.23
  $left = $cx - $s
  $right = $cx + $s
  $top = $cy - $s * 0.85
  $mid = $cy
  $bot = $cy + $s * 0.85
  # E shape
  $g.DrawLine($pen, $left, $top, $right, $top)
  $g.DrawLine($pen, $left, $mid, $right - $s*0.35, $mid)
  $g.DrawLine($pen, $left, $bot, $right, $bot)
  $g.DrawLine($pen, $left, $top, $left, $bot)

  # check accent
  $pen2 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 255, 255, 255), [float]($size * 0.055))
  $pen2.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen2.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen2.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $g.DrawLines($pen2, @(
    [System.Drawing.PointF]::new($cx + $s*0.15, $bot - $s*0.05),
    [System.Drawing.PointF]::new($cx + $s*0.45, $bot + $s*0.25),
    [System.Drawing.PointF]::new($cx + $s*1.05, $bot - $s*0.45)
  ))

  $pen2.Dispose(); $pen.Dispose(); $hl.Dispose(); $brush.Dispose(); $path.Dispose(); $g.Dispose()
  $dir = Split-Path $outPath -Parent
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "ok $outPath"
}

$base = "D:\Coding\EZRoutine\assets\icons"
Make-Icon 192 0 "$base\icon-192.png"
Make-Icon 512 0 "$base\icon-512.png"
Make-Icon 512 54 "$base\icon-maskable-512.png"
Make-Icon 180 0 "$base\apple-touch-icon.png"
Make-Icon 32 0 "$base\favicon-32.png"
