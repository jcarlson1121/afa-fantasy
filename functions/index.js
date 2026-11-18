// Position-ordered team rosters. Kept separate from the large snapshot HTML.
const enhancement = String.raw`<script>
(() => {
  // Live scoring configuration: changes affect rulesFor() before API data is scored.
  // Passing completions/attempts are neutral; WR and non-WR drops are neutral.
  if (typeof D !== 'undefined' && D.meta && D.meta.rules) {
    Object.assign(D.meta.rules.passing, {cmp:0, att:0});
    Object.assign(D.meta.rules.rushing, {bt:0.2});
    Object.assign(D.meta.rules.receiving, {drops:0, wrDrops:0});
    Object.assign(D.meta.rules.defense, {soloTkl:1.5, astTkl:0.5, tfl:2.25, pd:2});
    Object.assign(D.meta.rules.blocking, {sacksAllowed:-2});
  }
  // The base HTML includes a hard-coded old-rule note; keep it synchronized.
  if (typeof render === 'function') {
    const baseRender=render;
    render=function(){
      baseRender();
      if(typeof tab!=='undefined' && tab==='rules'){
        const panels=[...document.querySelectorAll('#view .note')];
        const oldNote=panels.find(el=>el.textContent.includes('Solo tackle: +1.2'));
        if(oldNote) oldNote.textContent='Updated AFA scoring: completions 0; pass attempts 0; broken tackles +0.2; all receiving drops 0; solo tackles +1.5; assisted tackles +0.5; tackles for loss +2.25; pass deflections +2; sacks allowed -2. Pancake blocks remain +1.8, defensive interceptions +6, and passing interceptions -2. Fantasy points are recalculated from the live game box scores whenever a live sync succeeds.';
      }
    };
    if(typeof tab!=='undefined' && tab==='rules')render();
  }

  // In each game's Fantasy Stats view, show metadata and running season points
  // through that specific game, not the player's eventual season total.
  if (typeof scorePlayerCell === 'function') {
    scorePlayerCell = function(entry) {
      if (!entry) return '<div class="muted small">—</div>';
      const player = entry.id ? P.find(p => String(p.id) === String(entry.id)) : null;
      const game = typeof openGameId !== 'undefined' ? D.scores.find(g => String(g.id) === String(openGameId)) : null;
      const week = game ? Number(game.week) : NaN;
      const currentGameId = game ? String(game.id) : '';
      const pos = player ? (player.pos || player.group || '—') : (entry.group && entry.group !== 'OTHER' ? entry.group : '—');
      const ovr = player && Number.isFinite(Number(player.ovr)) ? String(player.ovr) : '—';
      let total = null;
      if (player && game && Number.isFinite(week) && Array.isArray(player.games)) {
        total = player.games.reduce((sum, log) => {
          const logWeek = Number(log.week);
          // A same-week record counts only if it belongs to this exact game.
          if (Number.isFinite(logWeek) && (logWeek < week ||
              (logWeek === week && String(log.gameId || '') === currentGameId))) {
            const points = Number(log.score);
            return sum + (Number.isFinite(points) ? points : 0);
          }
          return sum;
        }, 0);
      }
      const totalText = total === null ? '—' : total.toFixed(2);
      const label = pos + ' · ' + ovr + ' OVR';
      return '<div class="playername">' +
        (entry.id ? '<button onclick="openPlayer(\'' + esc(entry.id) + '\')">' + esc(entry.name) + '</button>' : esc(entry.name)) +
        '</div><div class="substats" data-afa-total="' + esc(totalText) + '" title="' + esc(label) + '">' + esc(label) + '</div>';
    };
  }

  // Enhance the existing fantasy-versus view without changing actual game scoring.
  // Each team's side is tinted using the team's recorded primary color.
  if (typeof fantasyDetail === 'function') {
    const baseFantasyDetail = fantasyDetail;
    const readableColor = value => /^#[0-9a-fA-F]{6}$/.test(String(value || '')) ? value : '#344968';
    fantasyDetail = function(game) {
      const html = baseFantasyDetail(game);
      const container = document.createElement('div');
      container.innerHTML = html;
      const sides = game.sides || [];
      const colors = sides.map(side => {
        const team = T.find(t => String(t.id) === String(side.tid));
        return readableColor(team && team.color);
      });
      container.querySelectorAll('.playerline').forEach(line => {
        const scoreSpans = line.querySelectorAll('.fantasyscore > span');
        ['left','right'].forEach((sideName,index) => {
          const side = line.querySelector('.' + sideName);
          if (!side) return;
          const color = colors[index] || '#344968';
          side.style.setProperty('--afa-team-color', color);
          side.classList.add('afa-team-side');
          const sub = side.querySelector('.substats');
          const score = scoreSpans[index];
          if (!score || !score.textContent.trim()) return;
          const points = sub && sub.getAttribute('data-afa-total');
          const scoreText = score.textContent;
          score.classList.add('afa-scorecell');
          score.textContent = '';
          const weekly = document.createElement('span');
          weekly.className = 'afa-week-points';
          weekly.textContent = scoreText;
          score.appendChild(weekly);
          if (points && points !== '—') {
            const cumulative = document.createElement('span');
            cumulative.className = 'afa-season-points';
            cumulative.textContent = 'TOTAL ' + points;
            cumulative.title = 'Fantasy points accumulated through week ' + game.week;
            score.appendChild(cumulative);
          }
        });
      });
      return container.innerHTML;
    };
  }
  // Responsive two-sided game rows with subdued team-color backgrounds.
  const afaStyle = document.createElement('style');
  afaStyle.textContent = [
    '.playerline .afa-team-side{background:linear-gradient(135deg,color-mix(in srgb,var(--afa-team-color) 32%,#131b30),color-mix(in srgb,var(--afa-team-color) 17%,#131b30));padding:10px 8px;border-radius:9px;min-width:0;}',
    '.playerline .afa-team-side.left{border-left:3px solid var(--afa-team-color);}',
    '.playerline .afa-team-side.right{border-right:3px solid var(--afa-team-color);}',
    '.playerline .afa-team-side .playername{color:#fff;text-shadow:0 1px 2px #000a;}',
    '.playerline .afa-team-side .substats{color:#d4deee;font-weight:600;overflow-wrap:normal;white-space:normal;}',
    '.playerline .fantasyscore{align-items:center;gap:3px;}',
    '.playerline .fantasyscore .afa-scorecell{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:0;gap:3px;font-size:inherit;font-weight:900;}',
    '.playerline .afa-season-points{font-size:9px;line-height:1.2;letter-spacing:0;color:#aebed6;font-weight:700;white-space:nowrap;}',
    '@media(max-width:550px){.playerline{grid-template-columns:minmax(0,1fr) 100px minmax(0,1fr);gap:4px;}.playerline .afa-team-side{padding:9px 5px;}.playerline .fantasyscore{font-size:13px;gap:2px;}.playerline .afa-season-points{font-size:8px;letter-spacing:0;}.playerline .afa-team-side .playername{font-size:11px;}}'
  ].join('');
  document.head.appendChild(afaStyle);
  const order = ['QB','HB','WR','TE','OL','DT','EDGE','LB','CB','S','K','P','OTHER'];
  function group(position) {
    const p=String(position||'').toUpperCase().trim().replace(/[.\s_-]+/g,'');
    if(p==='QB')return 'QB';
    if(['HB','RB','FB','TB'].includes(p))return 'HB';
    if(['WR','SLOT'].includes(p))return 'WR';
    if(p==='TE')return 'TE';
    if(['OL','LT','LG','C','RG','RT','OT','OG','G','T'].includes(p))return 'OL';
    if(['DT','DT1','DT2','NT','IDL'].includes(p))return 'DT';
    if(['EDGE','LEDG','REDG','LE','RE','DE','RUSH'].includes(p))return 'EDGE';
    if(['LB','LOLB','ROLB','MLB','OLB','ILB','SAM','MIKE','WILL'].includes(p))return 'LB';
    if(['CB','CB1','CB2','DB','NB'].includes(p))return 'CB';
    if(['S','FS','SS','SAF'].includes(p))return 'S';
    if(['K','PK'].includes(p))return 'K';
    if(p==='P')return 'P';
    return 'OTHER';
  }
  function rank(p){const i=order.indexOf(group(p.group||p.pos));return i<0?order.length:i;}
  if(typeof options!=='function'||typeof filtered!=='function')return;
  const baseOptions=options;
  options=function(){
    return baseOptions().replace('<option value="points"',
      '<option value="position" '+(sort==='position'?'selected':'')+'>Position (QB → HB → WR → TE → OL → DT → EDGE → LB → CB → S → K → P)</option><option value="points"');
  };
  const baseFiltered=filtered;
  filtered=function(){
    const rows=baseFiltered();
    if(sort==='position')rows.sort((a,b)=>rank(a)-rank(b)||(Number(b.points)||0)-(Number(a.points)||0)||a.name.localeCompare(b.name));
    return rows;
  };
  document.addEventListener('click',e=>{if(e.target.closest('.teamcard'))sort='position';},true);
})();
</script>`;
export async function onRequest(context) {
  const response=await context.next();
  if(!response.ok||!(response.headers.get('content-type')||'').includes('text/html'))return response;
  return new HTMLRewriter().on('body',{element(el){el.append(enhancement,{html:true});}}).transform(response);
}
