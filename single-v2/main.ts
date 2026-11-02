import { mount } from 'svelte';
import HoloApp from '$lib/v2/HoloApp.svelte';

// Preview entry for the v2 UI (no SvelteKit router). / Entry preview cho UI v2 (không qua router SvelteKit).
const target = document.getElementById('app');
if (!target) throw new Error('#app not found / không tìm thấy #app');
mount(HoloApp, { target });
