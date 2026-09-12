import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as PImage from 'pureimage';
import { PassThrough } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface PnlCardParams {
  symbol: string;
  chainSymbol: string;
  pnlPct: number;
  pnlNative: number;
  boughtNative: number;
  soldNative: number;
  holdingAmount: number;
  botUsername?: string;
}

export class PosterService {
  private static fontLoaded = false;
  private static fontPromise: Promise<void> | null = null;

  private static async ensureFont(): Promise<void> {
    if (this.fontLoaded) return;
    if (this.fontPromise) return this.fontPromise;

    this.fontPromise = (async () => {
      const candidates = [
        '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
        '/System/Library/Fonts/Supplemental/Arial.ttf',
        '/Library/Fonts/Arial Bold.ttf',
        '/Library/Fonts/Arial.ttf',
      ];
      let fontPath = '';
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          fontPath = p;
          break;
        }
      }

      if (fontPath) {
        const fnt = PImage.registerFont(fontPath, 'ArialBold');
        await fnt.load();
        this.fontLoaded = true;
      }
    })();

    return this.fontPromise;
  }

  public static async generatePnlCard(params: PnlCardParams): Promise<Buffer> {
    await this.ensureFont();

    const templatePath = path.resolve(__dirname, '../../assets/pnl_template.jpg');
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template image not found at ${templatePath}`);
    }

    const stream = fs.createReadStream(templatePath);
    const img = await PImage.decodeJPEGFromStream(stream);
    const ctx = img.getContext('2d');

    const botUser = params.botUsername || 'whitecat_doge_yr3ybv_bot';
    const pairName = `${(params.symbol || 'TOKEN').toUpperCase()}/${params.chainSymbol.toUpperCase()}`;
    const isProfitable = params.pnlPct >= 0;
    const pnlSign = isProfitable ? '+' : '';
    const pnlPctText = `${pnlSign}${params.pnlPct.toFixed(2)}%`;
    const pnlAmtText = `PnL ${pnlSign}${params.pnlNative.toFixed(params.pnlNative === 0 ? 0 : 4)} ${params.chainSymbol.toUpperCase()}`;

    // 1. Top Header: clear & draw White.Cat.
    ctx.fillStyle = '#000000';
    ctx.fillRect(326, 38, 200, 30);
    ctx.fillStyle = '#ff6da2';
    ctx.font = '18pt ArialBold';
    ctx.fillText('White.Cat.', 330, 58);

    // 2. Left Box: Clear old text lines
    ctx.fillStyle = '#000000';
    ctx.fillRect(68, 90, 272, 48);   // Pair name area
    ctx.fillRect(68, 148, 272, 56);  // PnL % area
    ctx.fillRect(68, 214, 272, 52);  // PnL amount area

    // Dividers in left box
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(68, 142);
    ctx.lineTo(338, 142);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(68, 208);
    ctx.lineTo(338, 208);
    ctx.stroke();

    // Render Left Box text
    ctx.fillStyle = '#ff6da2';
    ctx.font = '22pt ArialBold';
    ctx.fillText(pairName, 70, 126);

    // PnL %
    ctx.fillStyle = isProfitable ? '#00ff44' : '#ff3355';
    ctx.font = '32pt ArialBold';
    ctx.fillText(pnlPctText, 70, 190);

    // PnL Amount
    ctx.fillStyle = '#ffffff';
    ctx.font = '19pt ArialBold';
    ctx.fillText(pnlAmtText, 70, 250);

    // 3. Right Box: Clear old text lines with matching pink
    const pinkHex = '#edaabd';
    ctx.fillStyle = pinkHex;
    ctx.fillRect(355, 90, 335, 48);   // Bought area
    ctx.fillRect(355, 148, 335, 56);  // Sold area
    ctx.fillRect(355, 214, 335, 52);  // Hold area

    // Dividers in right box
    ctx.strokeStyle = '#ea9eb5';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(355, 142);
    ctx.lineTo(680, 142);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(355, 208);
    ctx.lineTo(680, 208);
    ctx.stroke();

    // Render Right Box text
    ctx.font = '19pt ArialBold';
    ctx.fillStyle = '#ffffff';

    // Format numbers
    const boughtStr = `${params.boughtNative.toFixed(params.boughtNative === 0 ? 0 : (params.boughtNative >= 1 ? 2 : 4))} ${params.chainSymbol.toUpperCase()}`;
    const soldStr = `${params.soldNative.toFixed(params.soldNative === 0 ? 0 : (params.soldNative >= 1 ? 2 : 4))} ${params.chainSymbol.toUpperCase()}`;
    const holdStr = params.holdingAmount > 0 
      ? `${params.holdingAmount >= 1000 ? params.holdingAmount.toFixed(0) : params.holdingAmount.toFixed(2)} ${params.symbol.toUpperCase()}`
      : `0 ${params.chainSymbol.toUpperCase()}`;

    // Row 1: Bought
    ctx.fillText('Bought', 362, 126);
    ctx.fillText(boughtStr, 530, 126);

    // Row 2: Sold
    ctx.fillText('Sold', 362, 190);
    ctx.fillText(soldStr, 530, 190);

    // Row 3: Hold
    ctx.fillText('Hold', 362, 250);
    ctx.fillText(holdStr, 530, 250);

    // 4. Footer Handles
    // Left footer: Keep paper plane icon at 75-102, clear text from 104 to 330
    ctx.fillStyle = '#000000';
    ctx.fillRect(104, 590, 226, 28);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12pt ArialBold';
    ctx.fillText(`@${botUser}`, 106, 608);

    // Right footer: Keep X icon at 460-482, clear text from 484 to 650
    ctx.fillStyle = '#000000';
    ctx.fillRect(484, 590, 166, 28);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('@whitecat_bot', 488, 608);

    // Encode to PNG buffer
    const pt = new PassThrough();
    const chunks: Buffer[] = [];
    pt.on('data', (c) => chunks.push(c));

    await PImage.encodePNGToStream(img, pt);
    return Buffer.concat(chunks);
  }
}
