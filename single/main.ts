import { mount } from 'svelte';
import App from '$lib/components/App.svelte';
import '../src/app.css';

// Preview entry: mount App without SvelteKit. / Entry cho preview: mount App không qua SvelteKit.
const target = document.getElementById('app');
if (!target) throw new Error('#app not found / không tìm thấy #app');
mount(App, { target });
