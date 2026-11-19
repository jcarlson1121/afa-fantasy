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
        const scoreBox = line.querySelector('.fantasyscore');
        const scoreSpans = scoreBox ? scoreBox.querySelectorAll(':scope > span') : [];
        ['left','right'].forEach((sideName,index) => {
          const side = line.querySelector('.' + sideName);
          if (!side) return;
          const color = colors[index] || '#344968';
          side.style.setProperty('--afa-team-color', color);
          side.classList.add('afa-team-side');
          const sub = side.querySelector('.substats');
          const score = scoreSpans[index];
          // Keep the player information and score together within one team-color panel.
          const info = document.createElement('div');
          info.className = 'afa-player-info';
          while (side.firstChild) info.appendChild(side.firstChild);
          side.appendChild(info);
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
            cumulative.textContent = points;
            cumulative.title = 'Fantasy points accumulated through week ' + game.week;
            score.appendChild(cumulative);
          }
          // Both numbers now live inside the colored panel, not the middle column.
          side.appendChild(score);
        });
        if (scoreBox) scoreBox.remove();
      });
      return container.innerHTML;
    };
  }

  // Position-specific total fantasy-point rankings, calculated from the active dataset.
  // Rankings intentionally use existing scored points; they do not modify scoring or sync.
  const afaPositions=['QB','HB','WR','TE','OL','DT','EDGE','LB','CB','S','K','P','OTHER'];
  const afaPositionOf=p=>{
    const raw=String((p && (p.group||p.pos))||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(['RB','FB','TB'].includes(raw))return 'HB';
    if(['LT','LG','C','RG','RT','OT','OG'].includes(raw))return 'OL';
    if(['LE','RE','LEDG','REDG','DE'].includes(raw))return 'EDGE';
    if(['SAM','MIKE','WILL','MLB','OLB','ILB','LOLB','ROLB'].includes(raw))return 'LB';
    if(['FS','SS','SAF'].includes(raw))return 'S';
    if(['PK'].includes(raw))return 'K';
    return afaPositions.includes(raw)?raw:'OTHER';
  };
  function afaRankings(){
    const result={};
    afaPositions.forEach(pos=>result[pos]=[]);
    if(typeof P==='undefined'||!Array.isArray(P))return result;
    P.forEach(p=>{
      const games=Number(p.gp);
      const total=Number(p.points);
      if(!Number.isFinite(games)||games<=0||!Number.isFinite(total))return;
      const position=afaPositionOf(p);
      result[position].push({id:String(p.id),name:String(p.name||'Unknown'),team:String(p.abbr||p.team||''),games,points:total,ppg:total/games});
    });
    afaPositions.forEach(pos=>{
      result[pos].sort((a,b)=>b.points-a.points||b.ppg-a.ppg||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
      result[pos]=result[pos].slice(0,100).map((p,i)=>Object.assign(p,{rank:i+1}));
    });
    return result;
  }
  function afaRankFor(player){
    const pos=afaPositionOf(player);
    const record=afaRankings()[pos].find(p=>p.id===String(player.id));
    return record?'#'+record.rank:'';
  }
  // Display each eligible player's position rank directly above their name
  // in Scores > Fantasy Stats, without changing their weekly or season scores.
  if(typeof scorePlayerCell==='function'){
    const beforeRankCell=scorePlayerCell;
    scorePlayerCell=function(entry){
      const html=beforeRankCell(entry);
      if(!entry||!entry.id||typeof P==='undefined'||!Array.isArray(P))return html;
      const player=P.find(p=>String(p.id)===String(entry.id));
      if(!player)return html;
      const rank=afaRankFor(player);
      if(!rank)return html;
      return html.replace('<div class="playername">','<div class="afa-pos-rank">'+esc(rank)+'</div><div class="playername">');
    };
  }
  // Dedicated, position-filtered Top 100 total-points list. Recomputed whenever opened
  // so live updates are reflected without updating any stored data.
  function afaShowRankings(selected){
    const ranks=afaRankings();
    const position=afaPositions.includes(selected)?selected:'QB';
    const content=document.getElementById('afa-ppg-content');
    if(!content)return;
    const rows=ranks[position];
    content.innerHTML='<p class="muted small">Ranked by total fantasy points scored. Players without recorded games are excluded. Rankings use the current live-scored dataset.</p>'+
      '<div class="afa-ppg-table-wrap"><table class="afa-ppg-table"><thead><tr><th>Rank</th><th>Player</th><th>Team</th><th>GP</th><th>Total points</th><th>PPG</th></tr></thead><tbody>'+
      (rows.length?rows.map(p=>'<tr><td>#'+p.rank+'</td><td>'+esc(p.name)+'</td><td>'+esc(p.team)+'</td><td>'+p.games+'</td><td><strong>'+p.points.toFixed(2)+'</strong></td><td>'+p.ppg.toFixed(2)+'</td></tr>').join(''):'<tr><td colspan="6">No recorded games for this position.</td></tr>')+
      '</tbody></table></div>';
    document.querySelectorAll('.afa-ppg-position').forEach(b=>b.classList.toggle('active',b.dataset.position===position));
  }
  function afaOpenRankings(){
    let panel=document.getElementById('afa-ppg-panel');
    if(!panel){
      panel=document.createElement('div');
      panel.id='afa-ppg-panel';
      panel.innerHTML='<div class="afa-ppg-dialog" role="dialog" aria-modal="true" aria-label="Top 100 fantasy total points rankings"><button type="button" class="afa-ppg-close" aria-label="Close rankings">✕</button><h2>Top 100 Players by Position</h2><div class="afa-ppg-positions"></div><div id="afa-ppg-content"></div></div>';
      document.body.appendChild(panel);
      panel.querySelector('.afa-ppg-close').addEventListener('click',()=>panel.classList.remove('show'));
      panel.addEventListener('click',e=>{if(e.target===panel)panel.classList.remove('show');});
      document.addEventListener('keydown',e=>{if(e.key==='Escape')panel.classList.remove('show');});
      const menu=panel.querySelector('.afa-ppg-positions');
      afaPositions.forEach(position=>{
        const b=document.createElement('button');
        b.type='button';b.textContent=position;b.className='afa-ppg-position';b.dataset.position=position;
        b.addEventListener('click',()=>afaShowRankings(position));menu.appendChild(b);
      });
    }
    panel.classList.add('show');
    afaShowRankings('QB');
  }
  const afaRankButton=document.createElement('button');
  afaRankButton.type='button';
  afaRankButton.textContent='Top 100 Points';
  afaRankButton.className='afa-ppg-trigger';
  afaRankButton.addEventListener('click',afaOpenRankings);
  const afaNav=document.querySelector('header nav')||document.querySelector('nav')||document.querySelector('header');
  if(afaNav)afaNav.appendChild(afaRankButton);
  const afaRankStyle=document.createElement('style');
  afaRankStyle.textContent='.afa-pos-rank{font-size:10px;font-weight:850;color:#e6bb58;letter-spacing:.035em;margin-bottom:4px}.afa-ppg-trigger{background:#27354b;color:#b5f875;border:1px solid #506548;border-radius:8px;padding:9px 12px;font-weight:800;cursor:pointer}#afa-ppg-panel{position:fixed;inset:0;background:#080b13e8;z-index:1000;display:none;justify-content:center;align-items:flex-start;overflow:auto;padding:25px 12px}#afa-ppg-panel.show{display:flex}.afa-ppg-dialog{width:min(950px,100%);background:#1b2030;border:1px solid #3b435a;border-radius:16px;padding:22px;position:relative;color:#e9ecf7}.afa-ppg-dialog h2{margin:0 40px 18px 0}.afa-ppg-close{position:absolute;right:15px;top:15px;background:#30384c;color:white;border:0;border-radius:7px;padding:7px 11px;cursor:pointer}.afa-ppg-positions{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:15px}.afa-ppg-position{background:#293045;border:1px solid #485066;border-radius:7px;color:#e9ecf7;padding:8px 11px;cursor:pointer}.afa-ppg-position.active{background:#b5f875;color:#142016;font-weight:800}.afa-ppg-table-wrap{overflow:auto}.afa-ppg-table{width:100%;border-collapse:collapse;white-space:nowrap}.afa-ppg-table th,.afa-ppg-table td{padding:11px;text-align:left;border-bottom:1px solid #343b50}.afa-ppg-table th{font-size:11px;text-transform:uppercase;color:#aeb8cd}.afa-ppg-table td{font-size:13px}';
  document.head.appendChild(afaRankStyle);

  // Responsive two-sided game rows with subdued team-color backgrounds.
  const afaStyle = document.createElement('style');
  afaStyle.textContent = [
    '.gamewide .gamehero{grid-template-columns:minmax(0,1fr) 28px minmax(0,1fr);gap:4px;overflow:hidden;}',
    '.gamewide .gamehero .sideblock{min-width:0;max-width:100%;overflow:hidden;}',
    '.gamewide .gamehero .sidelogo,.gamewide .gamehero img.sidelogo{display:block;width:56px!important;height:56px!important;max-width:56px!important;max-height:56px!important;object-fit:contain!important;flex:none;}',
    '.gamewide .gamehero .teamlabel{overflow-wrap:anywhere;}',
    '.fantasyversus .playerline{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:7px;padding:7px 0;}',
    '.playerline .afa-team-side{display:flex;align-items:center;justify-content:space-between;gap:6px;min-width:0;min-height:76px;background:linear-gradient(135deg,color-mix(in srgb,var(--afa-team-color) 32%,#131b30),color-mix(in srgb,var(--afa-team-color) 17%,#131b30));padding:10px 8px;border-radius:9px;}',
    '.playerline .afa-team-side.left{border-left:3px solid var(--afa-team-color);}',
    '.playerline .afa-team-side.right{border-right:3px solid var(--afa-team-color);flex-direction:row-reverse;}',
    '.playerline .afa-team-side .afa-player-info{min-width:0;flex:1;}',
    '.playerline .afa-team-side .playername{color:#fff;text-shadow:0 1px 2px #000a;overflow-wrap:anywhere;}',
    '.playerline .afa-team-side .substats{color:#d4deee;font-weight:600;white-space:normal;}',
    '.playerline .afa-scorecell{display:flex;flex:none;flex-direction:column;justify-content:center;align-items:center;min-width:45px;gap:4px;line-height:1.15;color:#fff;font-weight:900;}',
    '.playerline .afa-week-points{font-size:16px;white-space:nowrap;}',
    '.playerline .afa-season-points{font-size:11px;line-height:1.2;color:#b9cce5;font-weight:650;white-space:nowrap;}',
    '@media(max-width:550px){.gamewide .gamehero .sidelogo,.gamewide .gamehero img.sidelogo{width:44px!important;height:44px!important;max-width:44px!important;max-height:44px!important;}.gamewide .gamehero{padding:12px 6px;}.gamewide .gamehero .bigscore{font-size:25px;}.fantasyversus .playerline{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:5px;}.playerline .afa-team-side{padding:8px 5px;gap:3px;min-height:68px;}.playerline .afa-team-side .playername{font-size:11px;}.playerline .afa-team-side .substats{font-size:9px;}.playerline .afa-scorecell{min-width:37px;gap:3px;}.playerline .afa-week-points{font-size:13px;}.playerline .afa-season-points{font-size:9px;}}'
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


  // Consistent, gold top-100 total-points position ranks on roster player names.
  // Uses the same rankings as the leaderboard and Fantasy Stats; does not
  // alter player order, original text, or any live data.
  if(typeof renderTable==='function'){
    const afaOriginalRenderTable=renderTable;
    renderTable=function(){
      afaOriginalRenderTable();
      if(!team)return;
      const rows=document.querySelectorAll('#rows tr');
      if(!rows.length)return;
      const rankings=afaRankings();
      const rankMap=new Map();
      Object.values(rankings).forEach(group=>group.forEach(p=>rankMap.set(String(p.id),p.rank)));
      const displayed=filtered().slice(0,400);
      rows.forEach((tr,i)=>{
        const player=displayed[i],button=tr.querySelector('td:nth-child(2) button');
        if(!player||!button)return;
        const rank=rankMap.get(String(player.id));
        if(!rank)return;
        const chip=document.createElement('span');
        chip.className='afa-roster-rank';
        chip.textContent='#'+rank+' ';
        button.prepend(chip);
      });
    };
  }
  const afaRosterRankStyle=document.createElement('style');
  afaRosterRankStyle.textContent='.afa-roster-rank{color:#e6bb58;font-weight:900;white-space:nowrap;margin-right:4px}';
  document.head.appendChild(afaRosterRankStyle);

  // Team hubs: actual offensive yards gained and defensive yards allowed
  // per completed game with valid team statistics. All calculations are in-browser.
  let afaSelectedTeam=null;
  function afaBuildTeamMetrics(){
    const metrics=new Map(T.map(t=>[String(t.id),{id:String(t.id),games:0,offGames:0,defGames:0,for:0,against:0,offense:null,defense:null,offRank:null,defRank:null}]));
    // Total offense is the primary source. Fall back to rushing + passing
    // only when both component fields are present and valid.
    const yards=side=>{
      const x=side&&side.stats||{};
      const direct=x.totalOffense??x.totalYards;
      if(direct!==null&&direct!==undefined&&direct!==''&&Number.isFinite(Number(direct)))return Number(direct);
      if(x.rushYards!=null&&x.passingYards!=null&&x.rushYards!==''&&x.passingYards!==''&&Number.isFinite(Number(x.rushYards))&&Number.isFinite(Number(x.passingYards)))
        return Number(x.rushYards)+Number(x.passingYards);
      return null;
    };
    for(const game of (D.scores||[])){
      if(!game.played||!Array.isArray(game.sides)||game.sides.length!==2)continue;
      const [a,b]=game.sides;
      const aYards=yards(a),bYards=yards(b);
      for(const [side,own,opponent] of [[a,aYards,bYards],[b,bYards,aYards]]){
        const m=metrics.get(String(side.tid));
        if(!m)continue;
        m.games++;
        if(own!==null){m.offGames++;m.for+=own;}
        if(opponent!==null){m.defGames++;m.against+=opponent;}
      }
    }
    const offense=Array.from(metrics.values()).filter(m=>m.offGames>0);
    const defense=Array.from(metrics.values()).filter(m=>m.defGames>0);
    offense.forEach(m=>m.offense=m.for/m.offGames);
    defense.forEach(m=>m.defense=m.against/m.defGames);
    offense.sort((a,b)=>b.offense-a.offense||a.id.localeCompare(b.id));
    defense.sort((a,b)=>a.defense-b.defense||a.id.localeCompare(b.id));
    // Competition ranks; tied unrounded averages share a rank.
    offense.forEach((m,i)=>m.offRank=i>0&&Math.abs(m.offense-offense[i-1].offense)<1e-9?offense[i-1].offRank:i+1);
    defense.forEach((m,i)=>m.defRank=i>0&&Math.abs(m.defense-defense[i-1].defense)<1e-9?defense[i-1].defRank:i+1);
    return {metrics,offRankedTeams:offense.length,defRankedTeams:defense.length};
  }
  const afaFmtRealYPG=v=>v==null?'—':v.toFixed(1);
  function afaTeamHub(){
    const t=T.find(t=>String(t.id)===String(afaSelectedTeam));
    if(!t){afaSelectedTeam=null;return;}
    const {metrics,offRankedTeams,defRankedTeams}=afaBuildTeamMetrics();
    const m=metrics.get(String(t.id));
    const games=(D.scores||[]).filter(g=>Array.isArray(g.sides)&&g.sides.some(s=>String(s.tid)===String(t.id)))
      .slice().sort((a,b)=>Number(a.week)-Number(b.week)||String(a.id).localeCompare(String(b.id)));
    const rankText=rank=>rank==null?'—':'#'+rank;
    const color=/^#[0-9a-fA-F]{6}$/.test(String(t.color||''))?t.color:'#344968';
    const rosterCount=P.filter(p=>String(p.tid)===String(t.id)).length;
    const view=document.getElementById('view');
    if(!view)return;
    view.innerHTML=
      '<div class="afa-team-hub">'+
        '<div class="afa-team-hero" style="--afa-hub-color:'+color+'">'+
          '<button type="button" class="btn" data-afa-action="back">← All Teams</button>'+
          '<div class="afa-team-ident">'+
            (t.logo?'<img src="'+esc(t.logo)+'" alt="" onerror="this.style.display=\'none\'">':'')+
            '<div><p class="muted small">AFA TEAM INTELLIGENCE · 2025 SEASON</p><h2>'+esc(t.name)+'</h2>'+
              '<p>'+esc(t.abbr)+' · '+t.w+'–'+t.l+' · '+m.games+' completed game'+(m.games===1?'':'s')+'</p></div>'+
          '</div>'+
        '</div>'+
        '<div class="afa-team-metric-grid">'+
          '<div class="afa-team-metric"><span>OFFENSE · YARDS / GAME</span><strong>'+afaFmtRealYPG(m.offense)+'</strong>'+
            '<div class="afa-team-ranking">'+rankText(m.offRank)+'</div></div>'+
          '<div class="afa-team-metric"><span>DEFENSE · YARDS ALLOWED / GAME</span><strong>'+afaFmtRealYPG(m.defense)+'</strong>'+
            '<div class="afa-team-ranking">'+rankText(m.defRank)+'</div></div>'+
        '</div>'+
        '<p class="muted small afa-team-explain">Actual football yards, not fantasy points. Offense = yards gained ÷ completed games with offensive yardage; defense = opponents’ yards gained ÷ completed games with opponent yardage. Games without those team stats are excluded from that average. Lower is better for defense.</p>'+
        '<div class="afa-team-hub-actions"><button class="btn" type="button" data-afa-action="roster">View roster · '+rosterCount+' players</button></div>'+
        '<div class="afa-team-hub-section"><h3>Game Hubs</h3><p class="muted small">Open any matchup for Fantasy Stats, Team Stats or Game Recap.</p>'+
        '<div class="scoregrid">'+games.map(g=>{
          const a=g.sides[0],b=g.sides[1];
          return '<button type="button" class="matchcard" data-afa-game="'+esc(g.id)+'">'+
            '<div class="matchtop"><span>WEEK '+g.week+(g.conf?' · CONFERENCE':'')+'</span><span>'+(g.played?'FINAL':'SCHEDULED')+'</span></div>'+
            [a,b].map(s=>'<div class="matchside '+(isWinner(g,s)?'win':'')+'">'+safeLogo(s)+'<strong>'+esc(s.name)+'</strong><span class="points">'+(g.played?(s.score??'—'):'—')+'</span></div>').join('')+
            (g.played?'<div class="teamfp"><span>Fantasy pts · '+esc(a.abbr)+' '+fmt2(a.fantasyTotal)+'</span><span>'+esc(b.abbr)+' '+fmt2(b.fantasyTotal)+'</span></div>':'<div class="teamfp">Box score not recorded yet</div>')+
          '</button>';
        }).join('')+'</div>'+(games.length?'':'<div class="empty">No games scheduled or recorded.</div>')+'</div>'+
      '</div>';
  }
  // Keep all previous rendering, including scores, player pages and scoring rules.
  const afaRenderBeforeTeamHub=render;
  render=function(){
    afaRenderBeforeTeamHub();
    if(tab==='teams'&&afaSelectedTeam!==null)afaTeamHub();
  };
  document.addEventListener('click',e=>{
    const nav=e.target.closest('nav button[data-tab="teams"]');
    if(nav){afaSelectedTeam=null;return;}
    const back=e.target.closest('[data-afa-action="back"]');
    if(back){e.preventDefault();afaSelectedTeam=null;tab='teams';render();return;}
    const roster=e.target.closest('[data-afa-action="roster"]');
    if(roster){e.preventDefault();team=String(afaSelectedTeam);afaSelectedTeam=null;tab='players';pos='ALL';query='';render();return;}
    const game=e.target.closest('[data-afa-game]');
    if(game){e.preventDefault();openScoreHub(game.getAttribute('data-afa-game'));return;}
    if(tab!=='teams'||afaSelectedTeam!==null)return;
    const card=e.target.closest('#teamgrid .teamcard');
    if(!card)return;
    // Stop the old inline handler that sends team clicks to the Players directory.
    e.preventDefault();e.stopImmediatePropagation();
    const cards=Array.from(document.querySelectorAll('#teamgrid .teamcard'));
    const teamIndex=cards.indexOf(card);
    const sorted=T.slice().sort((a,b)=>a.name.localeCompare(b.name));
    if(teamIndex<0||!sorted[teamIndex])return;
    afaSelectedTeam=String(sorted[teamIndex].id);
    render();
  },true);
  const afaTeamHubCSS=document.createElement('style');
  afaTeamHubCSS.textContent=[
    '.afa-team-hub{display:flex;flex-direction:column;gap:16px;}',
    '.afa-team-hero{padding:20px;border-radius:14px;border:1px solid #ffffff28;background:linear-gradient(115deg,color-mix(in srgb,var(--afa-hub-color) 65%,#131b30),color-mix(in srgb,var(--afa-hub-color) 25%,#131b30));}',
    '.afa-team-hero>.btn{margin-bottom:18px;}',
    '.afa-team-ident{display:flex;align-items:center;gap:16px;flex-wrap:wrap;}',
    '.afa-team-ident img{width:80px;height:80px;object-fit:contain;}',
    '.afa-team-ident h2{margin:4px 0 8px;}',
    '.afa-team-ident p{margin:4px 0;}',
    '.afa-team-metric-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}',
    '.afa-team-metric{background:#1d263b;border:1px solid #3a4862;border-radius:12px;padding:18px;min-width:0;}',
    '.afa-team-metric>span{font-size:12px;color:#a5b8d4;font-weight:800;letter-spacing:.03em;}',
    '.afa-team-metric>strong{display:block;font-size:35px;line-height:1.3;margin:7px 0;color:#f1f6ff;}',
    '.afa-team-ranking{color:#e6bb58;font-size:13px;font-weight:800;}',
    '.afa-team-explain{margin:0;line-height:1.5;}',
    '.afa-team-hub-actions{display:flex;gap:10px;flex-wrap:wrap;}',
    '.afa-team-hub-section h3{margin:8px 0;}',
    '@media(max-width:550px){.afa-team-metric-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}.afa-team-metric{padding:12px;}.afa-team-metric>strong{font-size:29px;}.afa-team-metric>span{font-size:10px;}.afa-team-ranking{font-size:11px;}.afa-team-ident img{width:55px;height:55px;}}'
  ].join('');
  document.head.appendChild(afaTeamHubCSS);

})();
</script>`;
export async function onRequest(context) {
  const response=await context.next();
  if(!response.ok||!(response.headers.get('content-type')||'').includes('text/html'))return response;
  return new HTMLRewriter().on('body',{element(el){el.append(enhancement,{html:true});}}).transform(response);
}
