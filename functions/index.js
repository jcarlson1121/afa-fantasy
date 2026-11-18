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


  // Reorganize Fantasy Stats into the eight specified, ordered combined position groups.
  // Reuse the original matchup rows and player scoring; only layout and subtotals change.
  const afaMatchGroups=['QB','HB/FB','WR/TE','OL','DT/EDGE','LBs','CB/S','K/P'];
  function afaMatchGroup(position){
    const p=String(position||'').toUpperCase();
    if(p==='QB')return 'QB';
    if(['HB','FB','RB','TB'].includes(p))return 'HB/FB';
    if(['WR','TE','SLOT'].includes(p))return 'WR/TE';
    if(['OL','LT','LG','C','RG','RT','OT','OG','G','T'].includes(p))return 'OL';
    if(['DT','EDGE','LEDG','REDG','LE','RE','DE','NT','IDL','RUSH'].includes(p))return 'DT/EDGE';
    if(['LB','SAM','MIKE','WILL','MLB','OLB','ILB','LOLB','ROLB'].includes(p))return 'LBs';
    if(['CB','S','FS','SS','DB','NB','SAF'].includes(p))return 'CB/S';
    if(['K','PK','P'].includes(p))return 'K/P';
    return null;
  }
  if(typeof fantasyDetail==='function'){
    const ungroupedFantasyDetail=fantasyDetail;
    fantasyDetail=function(game){
      const wrapper=document.createElement('div');
      wrapper.innerHTML=ungroupedFantasyDetail(game);
      const containers=wrapper.querySelectorAll('.fantasyversus');
      const table=containers[containers.length-1];
      if(!table||!game||!Array.isArray(game.sides)||game.sides.length<2)return wrapper.innerHTML;
      const originalRows=new Map();
      let current=null;
      Array.from(table.children).forEach(node=>{
        if(node.classList.contains('grouphead')){
          current=afaMatchGroup(node.textContent.trim());
        }else if(node.classList.contains('playerline')&&current){
          if(!originalRows.has(current))originalRows.set(current,[]);
          originalRows.get(current).push(node);
        }
      });
      const pointsBySide=game.sides.map(side=>{
        const totals=new Map(afaMatchGroups.map(group=>[group,0]));
        (side.players||[]).forEach(player=>{
          const profile=typeof P!=='undefined'?P.find(p=>String(p.id)===String(player.id)):null;
          const group=afaMatchGroup(profile?(profile.pos||profile.group):'');
          const score=Number(player.pts);
          if(group&&player.pts!==null&&player.pts!==undefined&&Number.isFinite(score))
            totals.set(group,totals.get(group)+score);
        });
        return totals;
      });
      table.replaceChildren();
      afaMatchGroups.forEach(group=>{
        const heading=document.createElement('div');
        heading.className='grouphead afa-combined-group';
        const title=document.createElement('span');
        title.textContent=group;
        const subtotal=document.createElement('strong');
        subtotal.className='afa-group-subtotal';
        subtotal.textContent=game.sides[0].abbr+' '+fmt2(pointsBySide[0].get(group))+'  ·  '+game.sides[1].abbr+' '+fmt2(pointsBySide[1].get(group));
        heading.append(title,subtotal);
        table.appendChild(heading);
        (originalRows.get(group)||[]).forEach(line=>table.appendChild(line));
      });
      return wrapper.innerHTML;
    };
  }
  const afaGroupCSS=document.createElement('style');
  afaGroupCSS.textContent='.fantasyversus .afa-combined-group{flex-wrap:wrap;gap:8px;margin:20px 0 7px}.fantasyversus .afa-combined-group:before,.fantasyversus .afa-combined-group:after{display:none}.afa-group-subtotal{margin-left:auto;color:#dce7f5;font-size:12px;font-weight:800;white-space:normal;text-align:right}.afa-combined-group span{flex:none}@media(max-width:550px){.afa-group-subtotal{width:100%;text-align:center;font-size:11px}}';
  document.head.appendChild(afaGroupCSS);

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

  // Position-specific fantasy points-per-game rankings, calculated from the active dataset.
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
      panel.innerHTML='<div class="afa-ppg-dialog" role="dialog" aria-modal="true" aria-label="Top 100 fantasy total-points rankings"><button type="button" class="afa-ppg-close" aria-label="Close rankings">✕</button><h2>Top 100 Players by Position</h2><div class="afa-ppg-positions"></div><div id="afa-ppg-content"></div></div>';
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
  afaRankStyle.textContent='.afa-pos-rank{font-size:10px;font-weight:850;color:#b5f875;letter-spacing:.035em;margin-bottom:4px}.afa-ppg-trigger{background:#27354b;color:#b5f875;border:1px solid #506548;border-radius:8px;padding:9px 12px;font-weight:800;cursor:pointer}#afa-ppg-panel{position:fixed;inset:0;background:#080b13e8;z-index:1000;display:none;justify-content:center;align-items:flex-start;overflow:auto;padding:25px 12px}#afa-ppg-panel.show{display:flex}.afa-ppg-dialog{width:min(950px,100%);background:#1b2030;border:1px solid #3b435a;border-radius:16px;padding:22px;position:relative;color:#e9ecf7}.afa-ppg-dialog h2{margin:0 40px 18px 0}.afa-ppg-close{position:absolute;right:15px;top:15px;background:#30384c;color:white;border:0;border-radius:7px;padding:7px 11px;cursor:pointer}.afa-ppg-positions{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:15px}.afa-ppg-position{background:#293045;border:1px solid #485066;border-radius:7px;color:#e9ecf7;padding:8px 11px;cursor:pointer}.afa-ppg-position.active{background:#b5f875;color:#142016;font-weight:800}.afa-ppg-table-wrap{overflow:auto}.afa-ppg-table{width:100%;border-collapse:collapse;white-space:nowrap}.afa-ppg-table th,.afa-ppg-table td{padding:11px;text-align:left;border-bottom:1px solid #343b50}.afa-ppg-table th{font-size:11px;text-transform:uppercase;color:#aeb8cd}.afa-ppg-table td{font-size:13px}';
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

  // Give every team a dedicated schedule/results page using the exact Score Hub.
  // Reuse openScoreHub() so all Fantasy Stats, Team Stats and Recap tabs stay identical.
  let afaTeamId=null;
  function afaTeamPage(id){
    const chosen=T.find(t=>String(t.id)===String(id));
    if(!chosen){afaTeamId=null;return;}
    const games=(D.scores||[]).filter(g=>(g.sides||[]).some(side=>String(side.tid)===String(chosen.id)))
      .slice().sort((a,b)=>Number(a.week)-Number(b.week)||String(a.id).localeCompare(String(b.id)));
    const view=document.getElementById('view');
    if(!view)return;
    view.innerHTML='<div class="afa-team-header"><button class="btn" type="button" onclick="afaBackToTeams()">← All Teams</button>'+
      '<div class="afa-team-title">'+(chosen.logo?'<img src="'+esc(chosen.logo)+'" alt="" onerror="this.style.display=\'none\'">':'')+
      '<div><h2>'+esc(chosen.name)+'</h2><p class="muted">'+chosen.w+'-'+chosen.l+' · '+games.length+' scheduled/recorded games</p></div></div>'+
      '<button class="btn" type="button" onclick="afaTeamRoster()">View Roster</button></div>'+
      '<h3>Game Hubs</h3><p class="muted small">Select any matchup to open the same game hub from Scores.</p>'+
      '<div class="scoregrid">'+games.map(g=>'<button class="matchcard" type="button" onclick="openScoreHub(\''+esc(g.id)+'\')">'+
        '<div class="matchtop"><span>WEEK '+g.week+(g.conf?' · CONFERENCE':'')+'</span><span>'+(g.played?'FINAL':'SCHEDULED')+'</span></div>'+
        g.sides.map(side=>'<div class="matchside '+(isWinner(g,side)?'win':'')+'">'+safeLogo(side)+'<strong>'+esc(side.name)+'</strong><span class="points">'+(g.played?(side.score??'—'):'—')+'</span></div>').join('')+
        (g.played?'<div class="teamfp"><span>Fantasy pts · '+esc(g.sides[0].abbr)+' '+fmt2(g.sides[0].fantasyTotal)+'</span><span>'+esc(g.sides[1].abbr)+' '+fmt2(g.sides[1].fantasyTotal)+'</span></div>':'<div class="teamfp">Box score not recorded yet</div>')+
        '</button>').join('')+'</div>'+
      (games.length?'':'<p class="empty">No recorded or scheduled games found for this team.</p>');
  }
  // Assign functions globally because team-page buttons are built with inline handlers.
  window.afaBackToTeams=function(){afaTeamId=null;render();};
  window.afaTeamRoster=function(){team=afaTeamId;afaTeamId=null;tab='players';query='';pos='ALL';render();};
  const afaRenderTeams=render;
  render=function(){
    afaRenderTeams();
    if(tab!=='teams')return;
    if(afaTeamId!==null)afaTeamPage(afaTeamId);
  };
  document.addEventListener('click',event=>{
    const teamsNav=event.target.closest('nav button[data-tab="teams"]');
    if(teamsNav){afaTeamId=null;return;}
    if(tab!=='teams'||afaTeamId!==null)return;
    const card=event.target.closest('#teamgrid .teamcard');
    if(!card)return;
    const cards=Array.from(document.querySelectorAll('#teamgrid .teamcard'));
    const ordered=T.slice().sort((a,b)=>a.name.localeCompare(b.name));
    const chosen=ordered[cards.indexOf(card)];
    if(!chosen)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    afaTeamId=chosen.id;
    render();
  },true);
  const afaTeamStyle=document.createElement('style');
  afaTeamStyle.textContent='.afa-team-header{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin:10px 0 22px}.afa-team-title{display:flex;align-items:center;gap:15px;flex:1;min-width:200px}.afa-team-title img{width:64px;height:64px;object-fit:contain}.afa-team-title h2{margin:0}.afa-team-title p{margin:5px 0}.afa-team-header + h3{margin-top:22px}';
  document.head.appendChild(afaTeamStyle);

})();
</script>`;
export async function onRequest(context) {
  const response=await context.next();
  if(!response.ok||!(response.headers.get('content-type')||'').includes('text/html'))return response;
  return new HTMLRewriter().on('body',{element(el){el.append(enhancement,{html:true});}}).transform(response);
}
