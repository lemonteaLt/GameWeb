/**
 * 王国征伐 · 中世纪史诗矢量棋子 SVG 库 (Medieval Kingdom SVG Chess Pieces)
 * 白方：圣狮白金王国 (Ivory Marble & Radiant Gold Plate Armor with Royal Azure Gems)
 * 黑方：铁龙黑金帝国 (Burnished Iron & Bronze Plate Armor with Dragon Ruby Gems)
 */
const PieceSVG = (() => {
  const THEME = {
    w: {
      id: 'w',
      base: '#f6f1e8',
      baseGrad1: '#ffffff',
      baseGrad2: '#e5d9c5',
      baseGrad3: '#c8b69b',
      gold1: '#ffe07d',
      gold2: '#d4af37',
      gold3: '#8c6d1f',
      metal1: '#e8eef2',
      metal2: '#a4b3bf',
      metal3: '#5e7282',
      stroke: '#3a2e1d',
      gem: '#1e88e5',
      gemHighlight: '#90caf9',
      glow: 'rgba(30, 136, 229, 0.45)'
    },
    b: {
      id: 'b',
      base: '#2a272f',
      baseGrad1: '#4a4454',
      baseGrad2: '#282430',
      baseGrad3: '#15131a',
      gold1: '#e29b46',
      gold2: '#a66827',
      gold3: '#59340f',
      metal1: '#5a5463',
      metal2: '#35303d',
      metal3: '#1d1a22',
      stroke: '#110e14',
      gem: '#e53935',
      gemHighlight: '#ef9a9a',
      glow: 'rgba(229, 57, 53, 0.45)'
    }
  };

  function getGradients(t) {
    return `
      <defs>
        <!-- 基础甲胄渐变 -->
        <linearGradient id="armor-grad-${t.id}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${t.baseGrad1}" />
          <stop offset="50%" stop-color="${t.baseGrad2}" />
          <stop offset="100%" stop-color="${t.baseGrad3}" />
        </linearGradient>
        <!-- 黄金饰边渐变 -->
        <linearGradient id="gold-grad-${t.id}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${t.gold1}" />
          <stop offset="50%" stop-color="${t.gold2}" />
          <stop offset="100%" stop-color="${t.gold3}" />
        </linearGradient>
        <!-- 锻铁金属渐变 -->
        <linearGradient id="metal-grad-${t.id}" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${t.metal1}" />
          <stop offset="50%" stop-color="${t.metal2}" />
          <stop offset="100%" stop-color="${t.metal3}" />
        </linearGradient>
        <!-- 宝石辉光滤镜 -->
        <filter id="shadow-${t.id}" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="rgba(0,0,0,0.65)" />
        </filter>
      </defs>
    `;
  }

  // 基础皇家底座 (所有棋子共用立体双层雕花基座)
  function renderBase(t, width = 56, y1 = 86, y2 = 78, y3 = 72) {
    const hw1 = width / 2;
    const hw2 = hw1 - 4;
    const hw3 = hw2 - 4;
    return `
      <path d="M${50 - hw1} ${y1} L${50 + hw1} ${y1} L${50 + hw2} ${y2} L${50 - hw2} ${y2} Z" 
            fill="url(#gold-grad-${t.id})" stroke="${t.stroke}" stroke-width="1.8" />
      <path d="M${50 - hw2} ${y2} L${50 + hw2} ${y2} L${50 + hw3} ${y3} L${50 - hw3} ${y3} Z" 
            fill="url(#armor-grad-${t.id})" stroke="${t.stroke}" stroke-width="1.8" />
      <circle cx="50" cy="${(y2 + y3) / 2}" r="2" fill="${t.gem}" />
    `;
  }

  /**
   * 👑 国王 (King - 威严君王：皇权巨剑、华丽披风与重冠)
   */
  function king(color) {
    const t = THEME[color];
    return `
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${getGradients(t)}
        <g filter="url(#shadow-${t.id})">
          <!-- 基座 -->
          ${renderBase(t, 60, 89, 81, 74)}
          
          <!-- 王者大衣披风 -->
          <path d="M26 74 C26 50 32 42 22 36 C36 36 40 44 50 44 C60 44 64 36 78 36 C68 42 74 50 74 74 Z" 
                fill="url(#armor-grad-${t.id})" stroke="${t.stroke}" stroke-width="2.2" />
          
          <!-- 胸铠花纹 & 王室勋章 -->
          <path d="M42 44 L58 44 L55 74 L45 74 Z" fill="url(#gold-grad-${t.id})" stroke="${t.stroke}" stroke-width="1.2" />
          <polygon points="50,50 55,56 50,63 45,56" fill="${t.gem}" stroke="${t.stroke}" stroke-width="1.2" />
          
          <!-- 威严皇冠 -->
          <path d="M26 36 L30 22 L40 30 L50 16 L60 30 L70 22 L74 36 Z" 
                fill="url(#gold-grad-${t.id})" stroke="${t.stroke}" stroke-width="2.2" />
          
          <!-- 皇冠红蓝宝珠 -->
          <circle cx="30" cy="21" r="2.5" fill="${t.gem}" stroke="${t.stroke}" stroke-width="0.8" />
          <circle cx="40" cy="29" r="2" fill="${t.gem}" />
          <circle cx="50" cy="15" r="3.2" fill="${t.gem}" stroke="${t.stroke}" stroke-width="1" />
          <circle cx="60" cy="29" r="2" fill="${t.gem}" />
          <circle cx="70" cy="21" r="2.5" fill="${t.gem}" stroke="${t.stroke}" stroke-width="0.8" />
          
          <!-- 顶部帝国圣十字 / 龙皇宝珠 -->
          <path d="M48 6 L52 6 L52 10 L56 10 L56 13 L52 13 L52 16 L48 16 L48 13 L44 13 L44 10 L48 10 Z" 
                fill="url(#gold-grad-${t.id})" stroke="${t.stroke}" stroke-width="1.2" />
        </g>
      </svg>
    `;
  }

  /**
   * 👸 王后 (Queen - 摄政王后：金丝王冠、华贵长裙与璀璨权杖)
   */
  function queen(color) {
    const t = THEME[color];
    return `
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${getGradients(t)}
        <g filter="url(#shadow-${t.id})">
          <!-- 基座 -->
          ${renderBase(t, 58, 89, 81, 74)}
          
          <!-- 华贵优雅礼裙身段 -->
          <path d="M30 74 C30 52 38 44 32 35 C40 38 44 43 50 43 C56 43 60 38 68 35 C62 44 70 52 70 74 Z" 
                fill="url(#armor-grad-${t.id})" stroke="${t.stroke}" stroke-width="2.2" />
          
          <!-- 宫廷束腰与流苏金带 -->
          <path d="M44 43 L56 43 L53 74 L47 74 Z" fill="url(#gold-grad-${t.id})" opacity="0.85" />
          <circle cx="50" cy="54" r="3.8" fill="${t.gem}" stroke="${t.stroke}" stroke-width="1.2" />
          <circle cx="50" cy="65" r="2.5" fill="${t.gem}" />
          
          <!-- 优雅尖角冠冕 (Coronet) -->
          <path d="M26 35 L28 19 L38 28 L50 14 L62 28 L72 19 L74 35 Z" 
                fill="url(#gold-grad-${t.id})" stroke="${t.stroke}" stroke-width="2.2" />
          
          <!-- 冠冕五颗璀璨宝石 -->
          <circle cx="28" cy="18" r="2.5" fill="${t.gem}" stroke="${t.stroke}" stroke-width="0.8" />
          <circle cx="38" cy="27" r="2" fill="${t.gem}" />
          <circle cx="50" cy="13" r="3.2" fill="${t.gem}" stroke="${t.stroke}" stroke-width="1" />
          <circle cx="62" cy="27" r="2" fill="${t.gem}" />
          <circle cx="72" cy="18" r="2.5" fill="${t.gem}" stroke="${t.stroke}" stroke-width="0.8" />
        </g>
      </svg>
    `;
  }

  /**
   * 🧙/⚔️ 主教/象 (Bishop - 圣殿大主教/皇家学者：双耳主教法冠、圣典与金权杖)
   */
  function bishop(color) {
    const t = THEME[color];
    return `
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${getGradients(t)}
        <g filter="url(#shadow-${t.id})">
          <!-- 基座 -->
          ${renderBase(t, 54, 89, 81, 74)}
          
          <!-- 圣职法袍 -->
          <path d="M34 74 C34 56 38 48 37 42 C43 45 46 46 50 46 C54 46 57 45 63 42 C62 48 66 56 66 74 Z" 
                fill="url(#armor-grad-${t.id})" stroke="${t.stroke}" stroke-width="2.2" />
          
          <!-- 圣殿主教冠 (Mitre) -->
          <path d="M36 42 C36 28 42 14 50 10 C58 14 64 28 64 42 Z" 
                fill="url(#armor-grad-${t.id})" stroke="${t.stroke}" stroke-width="2.2" />
          
          <!-- 主教金边饰带 -->
          <path d="M50 10 L50 46" stroke="url(#gold-grad-${t.id})" stroke-width="3" />
          
          <!-- 冠冕斜切圣印 (Mitre cleft) -->
          <path d="M43 23 L55 35" stroke="${t.gem}" stroke-width="3" stroke-linecap="round" />
          
          <!-- 顶端圣珠 -->
          <circle cx="50" cy="8" r="3" fill="url(#gold-grad-${t.id})" stroke="${t.stroke}" stroke-width="1.2" />
          <!-- 胸前圣印吊坠 -->
          <circle cx="50" cy="57" r="3.5" fill="${t.gem}" stroke="${t.stroke}" stroke-width="1" />
        </g>
      </svg>
    `;
  }

  /**
   * 🐴 骑士/马 (Knight - 皇家战马与重铠骑兵：马铠雕饰、鬃毛与英武马首)
   */
  function knight(color) {
    const t = THEME[color];
    return `
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${getGradients(t)}
        <g filter="url(#shadow-${t.id})">
          <!-- 基座 -->
          ${renderBase(t, 56, 89, 81, 74)}
          
          <!-- 英武重装战马身躯与脖颈 -->
          <path d="M33 74 C33 66 31 52 38 41 C36 34 29 27 24 28 C26 23 34 23 40 27 C42 18 48 13 53 13 C57 13 58 17 56 23 C64 25 73 34 73 48 C73 63 67 74 67 74 Z" 
                fill="url(#armor-grad-${t.id})" stroke="${t.stroke}" stroke-width="2.4" />
          
          <!-- 马铠金边护鬃与倒刺 -->
          <path d="M53 14 L58 20 L64 19 L68 27 L74 32 L72 42" 
                stroke="url(#gold-grad-${t.id})" stroke-width="3.5" stroke-linecap="round" fill="none" />
          
          <!-- 战马炯炯有神的眼眸 -->
          <circle cx="41" cy="33" r="3.2" fill="${t.gem}" stroke="${t.stroke}" stroke-width="1" />
          <circle cx="42" cy="32" r="1" fill="#ffffff" />
          
          <!-- 皇家战马缰绳与勋章胸甲 -->
          <path d="M31 46 L55 60" stroke="url(#gold-grad-${t.id})" stroke-width="2.5" />
          <polygon points="46,53 51,57 46,62 41,57" fill="${t.gem}" stroke="${t.stroke}" stroke-width="1.2" />
        </g>
      </svg>
    `;
  }

  /**
   * 🏰 城堡/车 (Rook - 攻城石垒与坚固堡垒：石砌城垛、射箭垛口与金顶旗帜)
   */
  function rook(color) {
    const t = THEME[color];
    return `
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${getGradients(t)}
        <g filter="url(#shadow-${t.id})">
          <!-- 基座 -->
          ${renderBase(t, 58, 89, 81, 74)}
          
          <!-- 坚固巨石要塞塔身 -->
          <path d="M33 74 L37 36 L63 36 L67 74 Z" 
                fill="url(#armor-grad-${t.id})" stroke="${t.stroke}" stroke-width="2.4" />
          
          <!-- 城堡砖石横向分缝装饰 -->
          <path d="M35 56 L65 56 M36 46 L64 46" stroke="${t.stroke}" stroke-width="1.4" opacity="0.4" />
          
          <!-- 经典中世纪城垛 (Crenellations) -->
          <path d="M28 36 L28 22 L36 22 L36 28 L44 28 L44 22 L56 22 L56 28 L64 28 L64 22 L72 22 L72 36 Z" 
                fill="url(#gold-grad-${t.id})" stroke="${t.stroke}" stroke-width="2.2" />
          
          <!-- 城堡中央防卫射箭孔 (Arrowslit) -->
          <path d="M47 43 L53 43 L53 58 L47 58 Z" fill="${t.gem}" stroke="${t.stroke}" stroke-width="1.2" />
          <path d="M45 49 L55 49" stroke="${t.stroke}" stroke-width="1.2" />
        </g>
      </svg>
    `;
  }

  /**
   * ♟️ 士兵/兵 (Pawn - 皇家近卫步兵：护心圆盾、钢盔与尖矛徽章)
   */
  function pawn(color) {
    const t = THEME[color];
    return `
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${getGradients(t)}
        <g filter="url(#shadow-${t.id})">
          <!-- 基座 -->
          ${renderBase(t, 48, 89, 82, 75)}
          
          <!-- 步兵铠甲身躯 -->
          <path d="M38 75 C38 60 43 53 40 46 C45 48 55 48 60 46 C57 53 62 60 62 75 Z" 
                fill="url(#armor-grad-${t.id})" stroke="${t.stroke}" stroke-width="2.2" />
          
          <!-- 圆润精钢战盔 -->
          <circle cx="50" cy="33" r="14" 
                  fill="url(#armor-grad-${t.id})" stroke="${t.stroke}" stroke-width="2.2" />
          
          <!-- 钢盔金色护额与顶缨 -->
          <path d="M38 33 L62 33" stroke="url(#gold-grad-${t.id})" stroke-width="2.5" />
          <circle cx="50" cy="18" r="2.8" fill="url(#gold-grad-${t.id})" stroke="${t.stroke}" stroke-width="1" />
          
          <!-- 卫士胸前护心宝镜 -->
          <circle cx="50" cy="58" r="3.5" fill="${t.gem}" stroke="${t.stroke}" stroke-width="1.2" />
        </g>
      </svg>
    `;
  }

  return {
    getSVG(type, color) {
      switch (type.toLowerCase()) {
        case 'k': return king(color);
        case 'q': return queen(color);
        case 'b': return bishop(color);
        case 'n': return knight(color);
        case 'r': return rook(color);
        case 'p': return pawn(color);
        default: return '';
      }
    }
  };
})();
