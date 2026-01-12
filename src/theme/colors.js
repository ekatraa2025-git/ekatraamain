// eKatRaa brand colors from logo
// Primary gradient: #FF0000 → #FF7700 (red to orange)
// Accent: #FF4117 (eKatRaa red-orange)
// Secondary: #918F8F (gray)

const light = {
    primary: '#FF4117',          // eKatRaa red-orange from logo
    primaryGradientStart: '#FF0000',
    primaryGradientEnd: '#FF7700',
    secondary: '#FF7700',        // Orange from gradient
    accent: '#918F8F',           // Gray from logo
    background: '#FFFFFF',
    surface: '#FFF8F5',          // Light warm tint
    text: '#1F2937',
    textLight: '#6B7280',
    inputBackground: '#FFF5F2',  // Light orange tint
    border: '#FFE5DC',           // Light orange border
    card: '#FFFFFF',
    cardBorder: '#FFDDD0',
    error: '#DC2626',
    success: '#10B981',
    warning: '#F59E0B',
    white: '#FFFFFF',
    black: '#000000',
    overlay: 'rgba(0,0,0,0.5)',
    gradientStart: '#FF4117',
    gradientMiddle: '#FF6B35',
    gradientEnd: '#FF8C42',
};

const dark = {
    primary: '#FF5733',          // Slightly lighter for dark mode
    primaryGradientStart: '#FF3333',
    primaryGradientEnd: '#FF8800',
    secondary: '#FF9500',
    accent: '#A0A0A0',
    background: '#0F0F0F',
    surface: '#1A1A1A',
    text: '#F9FAFB',
    textLight: '#9CA3AF',
    inputBackground: '#262626',
    border: '#3D3D3D',
    card: '#1F1F1F',
    cardBorder: '#333333',
    error: '#EF4444',
    success: '#34D399',
    warning: '#FBBF24',
    white: '#FFFFFF',
    black: '#000000',
    overlay: 'rgba(0,0,0,0.7)',
    gradientStart: '#FF4117',
    gradientMiddle: '#FF6B35',
    gradientEnd: '#FF8C42',
};

export const colors = {
    ...light, // Backward compatibility
    light,
    dark,
};

// Gradient presets
export const gradients = {
    primary: ['#FF0000', '#FF4117', '#FF7700'],
    warm: ['#FF4117', '#FF6B35', '#FF8C42'],
    sunset: ['#FF4117', '#FF7700', '#FFB347'],
    splash: ['#FF4117', '#FF5722', '#FF7043'],
    card: ['#FFFFFF', '#FFF8F5'],
    darkCard: ['#1F1F1F', '#1A1A1A'],
};
