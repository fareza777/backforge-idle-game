import React from 'react';
import type {CSSProperties, ReactNode} from 'react';
import {
  AbsoluteFill, Composition, Easing, Img, Sequence, interpolate,
  registerRoot, staticFile, useCurrentFrame, useVideoConfig,
} from 'remotion';
import {Audio, Video} from '@remotion/media';

const ivory = '#fff0cb';
const gold = '#ffd17c';
const mint = '#acefcb';
const flame = '#ff9d64';
const ink = '#081614';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ease = Easing.bezier(.15,.82,.20,1);

const usePortrait = () => {
  const {width,height} = useVideoConfig();
  return height > width;
};

function Asset({file, style}: {file:string, style:CSSProperties}) {
  return <Img src={staticFile(file)} style={{position:'absolute', ...style}} />;
}

function Set({file, tint='green', focus='50%'}: {file:string, tint?:'green'|'fire'|'blue',focus?:string}) {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const color = {green:'6,22,17',fire:'28,11,6',blue:'5,19,27'}[tint];
  return <AbsoluteFill style={{background:ink,overflow:'hidden'}}>
    <Asset file={file} style={{
      inset:0,width:'100%',height:'100%',objectFit:'cover',objectPosition:focus,
      scale:interpolate(frame,[0,5*fps],[1.025,1.105],clamp),
    }} />
    <AbsoluteFill style={{background:
      'linear-gradient(111deg,rgba('+color+',.97),rgba('+color+',.77) 51%,rgba('+color+',.51)),linear-gradient(0deg,#040a0b 0%,transparent 48%)'}} />
  </AbsoluteFill>;
}

const particles = Array.from({length:37},(_,i) => ({
  x:(i*157+71)%1000/10, y:(i*61+107)%1000/10, r:i%5+2, v:20+(i*9)%78, a:.16+(i%6)*.10,
}));

function Sparks({color=gold}: {color?:string}) {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return <AbsoluteFill style={{overflow:'hidden',pointerEvents:'none'}}>
    {particles.map((p,i)=><div key={i} style={{position:'absolute',left:p.x+'%',top:p.y+'%',
      width:p.r,height:p.r,borderRadius:'50%',background:color,
      opacity:p.a*(.64+.36*Math.cos(frame/fps*2+i)), boxShadow:'0 0 12px '+color,
      translate:(frame/fps*(i%2===0?18:-12))+'px '+(-frame/fps*p.v)+'px',
    }}/>)}
  </AbsoluteFill>;
}

function Headline({label,lines,detail,accent=gold,top,left,width,size,center=false}:
 {label?:string,lines:readonly [string,string],detail?:string,accent?:string,top:number,left:number,width:number,size:number,center?:boolean}) {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return <div style={{position:'absolute',top,left,width,textAlign:center?'center':'left'}}>
    {label && <div style={{fontFamily:'Arial, sans-serif',fontWeight:800,letterSpacing:5,fontSize:26,
      marginBottom:25,color:accent,opacity:interpolate(frame,[0,.23*fps],[.65,1],clamp)}}>{label}</div>}
    {lines.map((line,i)=><div key={line} style={{
      fontFamily:'ForgeDisplay',fontSize:size,fontWeight:900,color:i?accent:ivory,letterSpacing:-1.8,
      lineHeight:.90,whiteSpace:'nowrap',textShadow:'0 9px 40px #020805ee',
      translate:interpolate(frame,[i*.09*fps,(i*.09+.38)*fps],[48,0],{...clamp,easing:ease})+'px 0',
      opacity:interpolate(frame,[i*.07*fps,(i*.07+.18)*fps],[.65,1],clamp),
    }}>{line}</div>)}
    {detail && <div style={{fontFamily:'Arial, sans-serif',fontWeight:700,lineHeight:1.23,fontSize:37,
      color:ivory,marginTop:32,maxWidth:width,textShadow:'0 2px 12px #000',
      opacity:interpolate(frame,[.2*fps,.62*fps],[0,1],clamp)}}>{detail}</div>}
  </div>;
}

function MetalFrame({children,x,y,w,h,angle=0,accent=gold}:{
  children:ReactNode,x:number,y:number,w:number,h:number,angle?:number,accent?:string,
}) {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return <div style={{position:'absolute',left:x,top:y,width:w,height:h,boxSizing:'border-box',
    background:'#11140e',overflow:'hidden',border:'4px solid '+accent,borderRadius:26,
    boxShadow:'0 22px 85px #040806df',rotate:angle+'deg',
    translate:'0 '+interpolate(frame,[0,.65*fps],[54,0],{...clamp,easing:ease})+'px',
  }}>{children}</div>;
}

function Footnote({value,accent=ivory}: {value:string,accent?:string}) {
  const portrait = usePortrait();
  return <div style={{position:'absolute',bottom:portrait?122:86,left:portrait?64:84,
    right:portrait?64:84,letterSpacing:1.1,color:accent,font:'bold 37px Arial',
    textAlign:portrait?'center':'left',textShadow:'0 2px 9px #000'}}>{value}</div>;
}

function Flare({at=0,intensity=.30, color='255,184,103'}:{at?:number,intensity?:number,color?:string}) {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  return <AbsoluteFill style={{
    opacity:interpolate(f,[at*fps,(at+.22)*fps],[intensity,0],clamp) * Number(f>=at*fps),
    background:'radial-gradient(ellipse at 52% 53%,rgba('+color+',1),transparent 72%)',
    mixBlendMode:'screen',pointerEvents:'none',
  }}/>;
}

function ColdOpen() {
  const portrait=usePortrait();
  const frame=useCurrentFrame();
  const {fps,width,height}=useVideoConfig();
  return <>
    <Set file="key-art.jpg" tint="fire" focus="75%" />
    <Sparks color={flame}/>
    {[0,1].map(i=><Asset key={i} file="sword.webp" style={{
      objectFit:'contain',width:portrait?484:544,height:portrait?645:734,
      left:portrait?55+i*475:640+i*555,top:portrait?588:285,
      rotate:(i===0?-35:32)+'deg',filter:'drop-shadow(0 24px 30px #090803)',
      translate:interpolate(frame,[0,1.5*fps],i===0?[-226,260]:[226,-260],{...clamp,easing:ease})+'px 0',
    }}/>)}
    <div style={{position:'absolute',top:portrait?113:97,left:portrait?64:85,
      width:width-(portrait?128:170),fontFamily:'ForgeDisplay',fontSize:portrait?174:219,
      lineHeight:.88,color:ivory,textShadow:'0 8px 32px #080603'}}>TWO SWORDS.</div>
    {portrait && <div style={{position:'absolute',inset:'auto 0 0',height:height*.28,background:'linear-gradient(0deg,#0c140df2,transparent)'}}/>}
    <Flare at={.7} intensity={.5} />
  </>;
}

function Merge() {
  const portrait=usePortrait();
  const {fps}=useVideoConfig();
  return <>
    <Set file="key-art.jpg" tint="fire" focus="69%" />
    <Sparks color={flame}/>
    <Headline label="BACKPACK FORGE" lines={['ONE BETTER','BLADE.']} accent={flame}
      top={portrait?129:247} left={portrait?70:76} width={portrait?940:800} size={portrait?168:153} />
    <MetalFrame x={portrait?70:909} y={portrait?583:106} w={portrait?940:900}
      h={portrait?907:867} angle={portrait?0:1} accent={flame}>
      <Video src={staticFile('merge-play.mp4')} muted premountFor={fps} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
    </MetalFrame>
    <Footnote value="Drag matching gear to forge the next tier." />
    <Flare at={2.08} intensity={.61}/>
  </>;
}

function Bonds() {
  const portrait=usePortrait();
  return <>
    <Set file="ironbridge-foundry-arena.jpg" tint="blue"/>
    <Sparks color={mint}/>
    <Headline label="THE TACTICAL BACKPACK" lines={['EVERY SLOT','COUNTS.']} accent={mint}
      top={portrait?116:216} left={portrait?67:81} width={portrait?960:680}
      size={portrait?159:145} detail={portrait?undefined:'Place boosters beside gear to change how your knight fights.'}/>
    <MetalFrame x={portrait?82:840} y={portrait?615:112} w={portrait?916:999}
      h={portrait?854:932} angle={portrait?0:-2} accent={mint}>
      <Asset file="build-detail.jpg" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
    </MetalFrame>
    <Asset file="ember.webp" style={{width:portrait?164:127,left:portrait?468:457,top:portrait?1500:792,
      filter:'drop-shadow(0 0 36px #fd772998)'}}/>
    <Asset file="whetstone.webp" style={{width:portrait?186:151,left:portrait?196:218,top:portrait?1496:775,
      rotate:'-12deg'}}/>
    {portrait && <Footnote value="Boost neighboring gear. Unlock Set Bonds." />}
    <Flare color="160,230,197" />
  </>;
}

function Combat({finisher=false}: {finisher?:boolean}) {
  const portrait=usePortrait();
  const {fps}=useVideoConfig();
  return <>
    <Set file={finisher?'sunlit-forge-valley.jpg':'emberpeak-citadel-arena.jpg'} tint={finisher?'green':'fire'}/>
    <Sparks color={flame}/>
    <Asset file={(finisher?'forge-knight-hero':'forge-colossus-boss')+'.webp'} style={{
      left:portrait?(finisher?264:302):144,top:portrait?(finisher?1106:1090):456,
      width:portrait?545:545,height:portrait?708:570,objectFit:'contain',objectPosition:'center bottom',
      filter:'drop-shadow(0 12px 28px #0a100c)',rotate:finisher?'-8deg':undefined,
    }}/>
    <Headline label={finisher?undefined:'AUTO-BATTLE'} lines={finisher?['PACK SMART.','HIT HARD.']:['CRUSH THE','COLOSSUS.']}
      accent={finisher?gold:flame} width={portrait?956:745} left={portrait?62:80} top={portrait?122:121}
      size={portrait?169:143} />
    <MetalFrame x={portrait?59:816} y={portrait?525:149} w={portrait?962:1020}
      h={portrait?710:753} accent={finisher?gold:flame} angle={portrait?0:2}>
      <Video src={staticFile(finisher?'wave.mp4':'colossus.mp4')} muted premountFor={fps}
        style={{width:'100%',height:'100%'}}/>
    </MetalFrame>
    {!finisher && <div style={{position:'absolute',textAlign:portrait?'left':'center',
      left:portrait?60:810,top:portrait?1395:974,width:portrait?260:1030,color:ivory,
      font:'bold '+(portrait?38:32)+'px Arial',textShadow:'0 2px 10px #000'}}>Your knight fights automatically.</div>}
    <Flare at={finisher?.85:2.55} intensity={finisher?.33:.55} />
  </>;
}

function Armory() {
  const portrait=usePortrait();
  const f=useCurrentFrame();
  const {fps}=useVideoConfig();
  return <>
    <Set file="sunlit-forge-valley.jpg" tint="green"/>
    <Sparks/>
    <Headline label="THE ARMORY" lines={['15 GEAR TYPES','7 FORGE TIERS']} accent={gold}
      left={portrait?63:78} top={portrait?115:196} width={portrait?970:850}
      size={portrait?150:134} detail={portrait?undefined:'Blades, shields, boosters and more.'}/>
    <MetalFrame x={portrait?209:1100} y={portrait?607:123} w={portrait?742:657}
      h={portrait?1011:895} angle={portrait?-4:2} accent={gold}>
      <Asset file="gear-detail.jpg" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
    </MetalFrame>
    <Asset file="axe.webp" style={{width:portrait?350:371,top:portrait?964:572,left:portrait?34:421,rotate:'-19deg',
      translate:'0 '+interpolate(f,[0,4.5*fps],[55,-31],clamp)+'px',filter:'drop-shadow(0 12px 15px #000b)'}}/>
    {portrait && <Footnote value="Find your favorite loadout."/>}
  </>;
}

function Journey() {
  const portrait=usePortrait();
  return <>
    <Set file="emberpeak-citadel-arena.jpg" tint="green"/>
    <Sparks/>
    <MetalFrame x={portrait?76:935} y={portrait?507:160} w={portrait?918:870}
      h={portrait?518:489} angle={portrait?-4:4}>
      <Asset file="sunlit-forge-valley.jpg" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
    </MetalFrame>
    <MetalFrame x={portrait?72:883} y={portrait?1032:522} w={portrait?920:884}
      h={portrait?517:497} angle={portrait?4:-4} accent='#a8c5b0'>
      <Asset file="emberpeak-citadel-arena.jpg" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
    </MetalFrame>
    <Headline label="VALLEY TO EMBERPEAK" lines={['8 STORY','CHAPTERS.']} accent={gold}
      left={portrait?67:80} top={portrait?98:220} width={portrait?940:750}
      size={portrait?163:166} detail={portrait?undefined:'Relight the valley, one wave at a time.'} />
    {portrait && <Footnote value="Relight the valley, one wave at a time."/>}
  </>;
}

function Idle() {
  const portrait=usePortrait();
  return <>
    <Set file="ironbridge-foundry-arena.jpg" tint="blue"/>
    <Sparks color={mint}/>
    <Headline label="IDLE REWARDS" lines={['THE FORGE','STAYS LIT.']} accent={mint}
      left={portrait?70:78} top={portrait?120:236} width={portrait?940:752} size={portrait?161:154}
      detail={portrait?undefined:'Come back to claim up to 12 hours of gold and ore.'}/>
    <MetalFrame x={portrait?88:902} y={portrait?620:95} w={portrait?904:900}
      h={portrait?908:903} angle={portrait?0:-2} accent={mint}>
      <Asset file="offline-detail.jpg" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
    </MetalFrame>
    {portrait && <Footnote value="Claim up to 12 hours of idle rewards." />}
  </>;
}

function EndCard() {
  const portrait=usePortrait();
  const f=useCurrentFrame();
  const {fps}=useVideoConfig();
  return <>
    <Asset file="key-art.jpg" style={{inset:0,width:'100%',height:'100%',objectFit:'cover',
      objectPosition:portrait?'79% 50%':'center',
      scale:interpolate(f,[0,4.5*fps],[1.07,1.015],clamp)}}/>
    <AbsoluteFill style={{background:portrait?
      'linear-gradient(180deg,#071712fa,#081715ea 18%,#07180c12 52%,#08140be8 89%)':
      'linear-gradient(90deg,#081610f7 0%,#0c1b13d9 31%,#0a1a0c17 72%)'}}/>
    <Headline lines={['BACKPACK','FORGE']} accent={gold} left={portrait?68:88} top={portrait?90:248}
      size={portrait?184:188} width={portrait?944:900} center={portrait}/>
    <div style={{position:'absolute',left:portrait?0:94,top:portrait?455:625,width:portrait?'100%':'auto',
      textAlign:portrait?'center':'left',font:'bold 38px Arial',letterSpacing:6,color:ivory}}>IDLE MERGE RPG</div>
    <div style={{position:'absolute',left:portrait?0:98,bottom:portrait?124:162,width:portrait?'100%':'auto',
      textAlign:portrait?'center':'left',font:'bold 26px Arial',letterSpacing:4,color:ivory,
      textShadow:'0 3px 10px #000'}}>MECHA LEGION × F7 DEVELOPER</div>
    <Sparks/>
    <Flare intensity={.42}/>
  </>;
}

const Trailer = () => {
  const {fps} = useVideoConfig();
  return <AbsoluteFill style={{background:ink,color:ivory}}>
    <style>{'@font-face{font-family:ForgeDisplay;src:url('+staticFile('BarlowCondensed-Black.ttf')+') format("truetype");font-weight:900;font-display:block}'}</style>
    <Audio src={staticFile('forge-score.wav')} premountFor={fps}/>
    <Sequence name="Two swords" from={0} durationInFrames={1.5*fps}><ColdOpen/></Sequence>
    <Sequence name="Drag to merge" from={1.5*fps} durationInFrames={4*fps} premountFor={fps}><Merge/></Sequence>
    <Sequence name="Tactical backpack" from={5.5*fps} durationInFrames={4.5*fps} premountFor={fps}><Bonds/></Sequence>
    <Sequence name="Forge Colossus" from={10*fps} durationInFrames={5*fps} premountFor={fps}><Combat/></Sequence>
    <Sequence name="The armory" from={15*fps} durationInFrames={4.5*fps} premountFor={fps}><Armory/></Sequence>
    <Sequence name="Eight story chapters" from={19.5*fps} durationInFrames={4.5*fps} premountFor={fps}><Journey/></Sequence>
    <Sequence name="Idle rewards" from={24*fps} durationInFrames={4.5*fps} premountFor={fps}><Idle/></Sequence>
    <Sequence name="Pack smart, hit hard" from={28.5*fps} durationInFrames={3.5*fps} premountFor={fps}><Combat finisher/></Sequence>
    <Sequence name="Backpack Forge" from={32*fps} durationInFrames={5*fps} premountFor={fps}><EndCard/></Sequence>
  </AbsoluteFill>;
};

registerRoot(() => <>
  <Composition id="ForgeWide" component={Trailer} width={1920} height={1080} fps={30} durationInFrames={1110}/>
  <Composition id="ForgeVertical" component={Trailer} width={1080} height={1920} fps={30} durationInFrames={1110}/>
</>);



