import { createCanvas } from "canvas";
import { writeFileSync } from "fs";

const size = 600;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext("2d");

// 배경
ctx.fillStyle = "#17263f";
ctx.fillRect(0, 0, size, size);

// 픽셀 그리드
ctx.fillStyle = "rgba(255,255,255,0.04)";
for (let x = 0; x < size; x += 18) {
  for (let y = 0; y < size; y += 18) {
    ctx.fillRect(x, y, 1, 1);
  }
}

// 책상
ctx.fillStyle = "#c87838";
ctx.fillRect(120, 340, 360, 40);
ctx.fillRect(120, 380, 360, 40);

// 모니터
ctx.fillStyle = "#305d73";
ctx.fillRect(200, 200, 200, 140);
ctx.fillStyle = "#8bc0d6";
ctx.fillRect(210, 210, 180, 120);

// 모니터 텍스트
ctx.fillStyle = "#f7d08b";
ctx.font = "bold 28px 'Courier New', monospace";
ctx.fillText(">_", 240, 280);

// 모니터 받침대
ctx.fillStyle = "#35261c";
ctx.fillRect(280, 340, 40, 40);

// 캐릭터 얼굴
ctx.fillStyle = "#f4c28b";
ctx.fillRect(140, 260, 40, 40);
// 캐릭터 몸
ctx.fillStyle = "#d85f87";
ctx.fillRect(140, 300, 40, 80);
// 머리카락
ctx.fillStyle = "#5c3a1e";
ctx.fillRect(130, 250, 60, 20);
ctx.fillRect(130, 250, 10, 40);
ctx.fillRect(190, 250, 10, 40);

// 별
ctx.fillStyle = "#f2b84b";
ctx.fillRect(80, 80, 20, 20);
ctx.fillRect(500, 120, 16, 16);
ctx.fillRect(450, 60, 12, 12);
ctx.fillRect(60, 180, 14, 14);

// 하단 텍스트
ctx.fillStyle = "#f7d08b";
ctx.font = "bold 36px 'Courier New', monospace";
ctx.textAlign = "center";
ctx.fillText("취준생게임", 300, 500);

ctx.fillStyle = "#a9967d";
ctx.font = "18px 'Courier New', monospace";
ctx.fillText("일어나보니 대한민국 취준생", 300, 545);

const buf = canvas.toBuffer("image/png");
writeFileSync("public/app-logo.png", buf);
console.log("Generated public/app-logo.png");
