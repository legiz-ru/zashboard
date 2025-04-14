import plugin from 'tailwindcss/plugin'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ['low-latency']: 'oklch(0.648 0.15 160)',
        ['medium-latency']: 'rgb(250, 210, 75)',
        ['high-latency']: 'rgb(244, 96, 108)',
      },
    },
  },
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities({
        '.scrollbar-hidden': {
          'scrollbar-width': 'none!important',
        },
        '.scrollbar-thin': {
          'scrollbar-width': 'thin',
        },
        '.font-MiSans': {
          'font-family': 'MiSans-VF, NotoEmoji, system-ui',
        },
        '.font-SarasaUI': {
          'font-family': 'SarasaUiSC-Regular, NotoEmoji, system-ui',
        },
        '.font-PingFang': {
          'font-family': 'PingFangSC-Regular, NotoEmoji, system-ui',
        },
        '.font-FiraSans': {
          'font-family': 'Fira Sans, NotoEmoji, system-ui',
        },
        '.font-SystemUI': {
          'font-family': 'NotoEmoji, system-ui',
        },
      })
    }),
  ],
}
