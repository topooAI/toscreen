import { uIOhook } from 'uiohook-napi';

console.log('开始监听鼠标坐标，请移动鼠标以观察输出。3秒后自动关闭...');

let count = 0;
uIOhook.on('mousemove', (e) => {
    count++;
    if (count % 5 === 0) { // Limit logs to prevent flood
        console.log(`[uIOhook Event] x: ${e.x}, y: ${e.y}`);
    }
});

uIOhook.start();

setTimeout(() => {
    uIOhook.stop();
    console.log('监听完成。');
    process.exit(0);
}, 3000);
