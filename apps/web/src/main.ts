import { useTheme } from '@f-desk/ui'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import './styles/main.css'

useTheme().restoreTheme()

createApp(App).use(createPinia()).use(router).mount('#app')
