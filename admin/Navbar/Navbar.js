// TIENE COMO FUNCIONALIDAD HACER FUNCIONAR AL NAVBAR
import { protegerRuta } from "../../proteger.js";
await protegerRuta("admin");

const menu = document.getElementById('menu');
const sidebar = document.getElementById('sidebar');
const mainContent = document.querySelector('.main-content');
const container = document.querySelector('.container');
const containerm = document.querySelector('.containerm');


menu.addEventListener('click', () =>{
    sidebar.classList.toggle('menu-toggle');
    menu.classList.toggle('menu-toggle');
    mainContent?.classList.toggle('menu-toggle');
    container?.classList.toggle('menu-toggle');
    containerm?.classList.toggle('menu-toggle');
});