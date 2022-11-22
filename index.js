#!/usr/bin/env node

const https = require("https");
const fs = require("fs");
const path = require("path");
const PromisePool = require("p-pool");

const inputDir = process.argv[2] || ".";
const cwd = process.cwd();
const workingDir = path.resolve(cwd, inputDir);
const outputDir = path.resolve(workingDir, "./__tinypng_dir");
const TINYIMG_URL = ["tinyjpg.com", "tinypng.com"];

function getAllDirFiles() {
  const list = fs
    .readdirSync(workingDir)
    .filter((i) => i.endsWith(".png") || i.endsWith(".jpg"));
  return list;
}

function randomHeader() {
  const ip = new Array(4)
    .fill(0)
    .map(() => parseInt(Math.random() * 255))
    .join(".");
  const index = Math.round(Math.random());
  return {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36",
      "X-Forwarded-For": ip,
    },
    hostname: TINYIMG_URL[index],
    method: "POST",
    path: "/web/shrink",
  };
}

async function uploadImage(filePath) {
  const opts = randomHeader();
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      res.on("data", (data) => {
        const obj = JSON.parse(data.toString());
        obj.error ? reject(obj.message) : resolve(obj);
      });
    });
    const file = fs.readFileSync(filePath, "binary");
    req.write(file, "binary");
    req.on("error", (e) => {
      reject(e);
    });
    req.end();
  });
}

async function downloadFile(netUrl, downloadPath) {
  const writeStream = fs.createWriteStream(downloadPath, { flags: "w+" });
  return new Promise((resolve, reject) => {
    https
      .get(netUrl, (response) => {
        response.pipe(writeStream);
        writeStream.on("finish", resolve);
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}

async function main() {
  const list = getAllDirFiles();
  fs.mkdirSync(outputDir, { recursive: true });

  let tasks = [];
  for (let i = 0; i < list.length; i++) {
    const t = async () => {
      const filename = list[i];
      const filePath = path.resolve(workingDir, filename);
      const info = await uploadImage(filePath);
      await downloadFile(info.output.url, path.resolve(outputDir, filename));
      const inputSize = info.input.size;
      const outputSize = info.output.size;
      console.log(
        `压缩【${filename}】 [${inputSize}] -> [${outputSize}]  ${(
          (outputSize * 100) /
          inputSize
        ).toFixed(2)}%`
      );
    };
    tasks.push(t);
  }

  const pool = new PromisePool(tasks, 20);
  pool.run();
}

main();
