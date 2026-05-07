export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#0A1931',
        gold: '#C9A84C',
        ink: '#172033',
        line: '#E5E7EB'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui']
      },
      boxShadow: {
        gov: '0 10px 30px rgba(10, 25, 49, 0.08)'
      }
    }
  },
  plugins: []
};

