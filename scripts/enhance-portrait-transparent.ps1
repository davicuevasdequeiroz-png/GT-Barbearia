param(
    [Parameter(Mandatory = $true)][string]$InputPath,
    [Parameter(Mandatory = $true)][string]$OutputPath
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$source = [System.Drawing.Image]::FromFile($InputPath)
try {
    # Preserve the exact cutout and layout; only increase resolution.
    $scale = 3840.0 / [Math]::Max($source.Width, $source.Height)
    $width = [int][Math]::Round($source.Width * $scale)
    $height = [int][Math]::Round($source.Height * $scale)

    $output = New-Object System.Drawing.Bitmap $width, $height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
        $graphics = [System.Drawing.Graphics]::FromImage($output)
        try {
            $graphics.Clear([System.Drawing.Color]::Transparent)
            $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
            $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

            # Subtle neutral editorial grade. Alpha is deliberately unchanged.
            $attributes = New-Object System.Drawing.Imaging.ImageAttributes
            try {
                $matrix = New-Object System.Drawing.Imaging.ColorMatrix
                $matrix.Matrix00 = 1.045; $matrix.Matrix11 = 1.035; $matrix.Matrix22 = 1.020
                $matrix.Matrix40 = 0.001; $matrix.Matrix41 = 0.000; $matrix.Matrix42 = -0.001
                $attributes.SetColorMatrix($matrix, [System.Drawing.Imaging.ColorMatrixFlag]::Default, [System.Drawing.Imaging.ColorAdjustType]::Bitmap)
                $graphics.DrawImage($source, (New-Object System.Drawing.Rectangle 0, 0, $width, $height), 0, 0, $source.Width, $source.Height, [System.Drawing.GraphicsUnit]::Pixel, $attributes)
            }
            finally {
                $attributes.Dispose()
            }
        }
        finally {
            $graphics.Dispose()
        }

        $outDir = Split-Path -Parent $OutputPath
        if (-not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
        $output.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $output.Dispose()
    }
}
finally {
    $source.Dispose()
}
