param(
    [Parameter(Mandatory = $true)][string]$InputPath,
    [Parameter(Mandatory = $true)][string]$OutputPath
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$source = [System.Drawing.Image]::FromFile($InputPath)
try {
    # Keep the original composition exactly, scaling its longest edge to 3840 px.
    $scale = 3840.0 / [Math]::Max($source.Width, $source.Height)
    $width = [int][Math]::Round($source.Width * $scale)
    $height = [int][Math]::Round($source.Height * $scale)

    $resized = New-Object System.Drawing.Bitmap $width, $height, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    try {
        $graphics = [System.Drawing.Graphics]::FromImage($resized)
        try {
            $graphics.Clear([System.Drawing.Color]::Black)
            $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
            $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.DrawImage($source, (New-Object System.Drawing.Rectangle 0, 0, $width, $height))
        }
        finally {
            $graphics.Dispose()
        }

        $adjusted = New-Object System.Drawing.Bitmap $width, $height, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
        try {
            # Deliberately gentle editorial grade: neutral whites, controlled highlights,
            # slightly cool shadows, restrained saturation, and no beauty smoothing.
            $attributes = New-Object System.Drawing.Imaging.ImageAttributes
            try {
                $matrix = New-Object System.Drawing.Imaging.ColorMatrix
                $matrix.Matrix00 = 1.045; $matrix.Matrix11 = 1.035; $matrix.Matrix22 = 1.020
                $matrix.Matrix40 = 0.001; $matrix.Matrix41 = 0.000; $matrix.Matrix42 = -0.001
                $attributes.SetColorMatrix($matrix, [System.Drawing.Imaging.ColorMatrixFlag]::Default, [System.Drawing.Imaging.ColorAdjustType]::Bitmap)

                $g2 = [System.Drawing.Graphics]::FromImage($adjusted)
                try {
                    $g2.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
                    $g2.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
                    $g2.DrawImage($resized, (New-Object System.Drawing.Rectangle 0, 0, $width, $height), 0, 0, $width, $height, [System.Drawing.GraphicsUnit]::Pixel, $attributes)
                }
                finally {
                    $g2.Dispose()
                }
            }
            finally {
                $attributes.Dispose()
            }

            $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
            $parameters = New-Object System.Drawing.Imaging.EncoderParameters 1
            $parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 98L
            $outDir = Split-Path -Parent $OutputPath
            if (-not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
            $adjusted.Save($OutputPath, $encoder, $parameters)
        }
        finally {
            $adjusted.Dispose()
        }
    }
    finally {
        $resized.Dispose()
    }
}
finally {
    $source.Dispose()
}
