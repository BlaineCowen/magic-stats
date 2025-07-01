exports.id=175,exports.ids=[175],exports.modules={711:()=>{},2559:()=>{},4431:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>n,metadata:()=>o});var s=r(7413);r(5692);var i=r(1001),a=r.n(i);let o={title:"NFL Stats Query",description:"Natural language NFL statistics search engine",icons:[{rel:"icon",url:"/favicon.ico"}]};function n({children:e}){return(0,s.jsx)("html",{lang:"en",className:`${a().variable}`,children:(0,s.jsx)("body",{className:"min-h-screen bg-slate-50",children:e})})}},5672:(e,t,r)=>{Promise.resolve().then(r.t.bind(r,6346,23)),Promise.resolve().then(r.t.bind(r,7924,23)),Promise.resolve().then(r.t.bind(r,5656,23)),Promise.resolve().then(r.t.bind(r,99,23)),Promise.resolve().then(r.t.bind(r,8243,23)),Promise.resolve().then(r.t.bind(r,8827,23)),Promise.resolve().then(r.t.bind(r,2763,23)),Promise.resolve().then(r.t.bind(r,7173,23))},5692:()=>{},5944:(e,t,r)=>{Promise.resolve().then(r.t.bind(r,6444,23)),Promise.resolve().then(r.t.bind(r,6042,23)),Promise.resolve().then(r.t.bind(r,8170,23)),Promise.resolve().then(r.t.bind(r,9477,23)),Promise.resolve().then(r.t.bind(r,9345,23)),Promise.resolve().then(r.t.bind(r,2089,23)),Promise.resolve().then(r.t.bind(r,6577,23)),Promise.resolve().then(r.t.bind(r,1307,23))},7590:(e,t,r)=>{"use strict";r.d(t,{l$:()=>ed,Ay:()=>ec});var s,i=r(3210);let a={data:""},o=e=>"object"==typeof window?((e?e.querySelector("#_goober"):window._goober)||Object.assign((e||document.head).appendChild(document.createElement("style")),{innerHTML:" ",id:"_goober"})).firstChild:e||a,n=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,l=/\/\*[^]*?\*\/|  +/g,d=/\n+/g,c=(e,t)=>{let r="",s="",i="";for(let a in e){let o=e[a];"@"==a[0]?"i"==a[1]?r=a+" "+o+";":s+="f"==a[1]?c(o,a):a+"{"+c(o,"k"==a[1]?"":t)+"}":"object"==typeof o?s+=c(o,t?t.replace(/([^,])+/g,e=>a.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,t=>/&/.test(t)?t.replace(/&/g,e):e?e+" "+t:t)):a):null!=o&&(a=/^--/.test(a)?a:a.replace(/[A-Z]/g,"-$&").toLowerCase(),i+=c.p?c.p(a,o):a+":"+o+";")}return r+(t&&i?t+"{"+i+"}":i)+s},u={},p=e=>{if("object"==typeof e){let t="";for(let r in e)t+=r+p(e[r]);return t}return e},m=(e,t,r,s,i)=>{let a=p(e),o=u[a]||(u[a]=(e=>{let t=0,r=11;for(;t<e.length;)r=101*r+e.charCodeAt(t++)>>>0;return"go"+r})(a));if(!u[o]){let t=a!==e?e:(e=>{let t,r,s=[{}];for(;t=n.exec(e.replace(l,""));)t[4]?s.shift():t[3]?(r=t[3].replace(d," ").trim(),s.unshift(s[0][r]=s[0][r]||{})):s[0][t[1]]=t[2].replace(d," ").trim();return s[0]})(e);u[o]=c(i?{["@keyframes "+o]:t}:t,r?"":"."+o)}let m=r&&u.g?u.g:null;return r&&(u.g=u[o]),((e,t,r,s)=>{s?t.data=t.data.replace(s,e):-1===t.data.indexOf(e)&&(t.data=r?e+t.data:t.data+e)})(u[o],t,s,m),o},f=(e,t,r)=>e.reduce((e,s,i)=>{let a=t[i];if(a&&a.call){let e=a(r),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;a=t?"."+t:e&&"object"==typeof e?e.props?"":c(e,""):!1===e?"":e}return e+s+(null==a?"":a)},"");function h(e){let t=this||{},r=e.call?e(t.p):e;return m(r.unshift?r.raw?f(r,[].slice.call(arguments,1),t.p):r.reduce((e,r)=>Object.assign(e,r&&r.call?r(t.p):r),{}):r,o(t.target),t.g,t.o,t.k)}h.bind({g:1});let y,g,b,x=h.bind({k:1});function v(e,t){let r=this||{};return function(){let s=arguments;function i(a,o){let n=Object.assign({},a),l=n.className||i.className;r.p=Object.assign({theme:g&&g()},n),r.o=/ *go\d+/.test(l),n.className=h.apply(r,s)+(l?" "+l:""),t&&(n.ref=o);let d=e;return e[0]&&(d=n.as||e,delete n.as),b&&d[0]&&b(n),y(d,n)}return t?t(i):i}}var w=e=>"function"==typeof e,N=(e,t)=>w(e)?e(t):e,j=(()=>{let e=0;return()=>(++e).toString()})(),k=(()=>{let e;return()=>e})(),E=(e,t)=>{switch(t.type){case 0:return{...e,toasts:[t.toast,...e.toasts].slice(0,20)};case 1:return{...e,toasts:e.toasts.map(e=>e.id===t.toast.id?{...e,...t.toast}:e)};case 2:let{toast:r}=t;return E(e,{type:+!!e.toasts.find(e=>e.id===r.id),toast:r});case 3:let{toastId:s}=t;return{...e,toasts:e.toasts.map(e=>e.id===s||void 0===s?{...e,dismissed:!0,visible:!1}:e)};case 4:return void 0===t.toastId?{...e,toasts:[]}:{...e,toasts:e.toasts.filter(e=>e.id!==t.toastId)};case 5:return{...e,pausedAt:t.time};case 6:let i=t.time-(e.pausedAt||0);return{...e,pausedAt:void 0,toasts:e.toasts.map(e=>({...e,pauseDuration:e.pauseDuration+i}))}}},P=[],$={toasts:[],pausedAt:void 0},C=e=>{$=E($,e),P.forEach(e=>{e($)})},D={blank:4e3,error:4e3,success:2e3,loading:1/0,custom:4e3},O=(e={})=>{let[t,r]=(0,i.useState)($),s=(0,i.useRef)($);(0,i.useEffect)(()=>(s.current!==$&&r($),P.push(r),()=>{let e=P.indexOf(r);e>-1&&P.splice(e,1)}),[]);let a=t.toasts.map(t=>{var r,s,i;return{...e,...e[t.type],...t,removeDelay:t.removeDelay||(null==(r=e[t.type])?void 0:r.removeDelay)||(null==e?void 0:e.removeDelay),duration:t.duration||(null==(s=e[t.type])?void 0:s.duration)||(null==e?void 0:e.duration)||D[t.type],style:{...e.style,...null==(i=e[t.type])?void 0:i.style,...t.style}}});return{...t,toasts:a}},z=(e,t="blank",r)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:t,ariaProps:{role:"status","aria-live":"polite"},message:e,pauseDuration:0,...r,id:(null==r?void 0:r.id)||j()}),A=e=>(t,r)=>{let s=z(t,e,r);return C({type:2,toast:s}),s.id},S=(e,t)=>A("blank")(e,t);S.error=A("error"),S.success=A("success"),S.loading=A("loading"),S.custom=A("custom"),S.dismiss=e=>{C({type:3,toastId:e})},S.remove=e=>C({type:4,toastId:e}),S.promise=(e,t,r)=>{let s=S.loading(t.loading,{...r,...null==r?void 0:r.loading});return"function"==typeof e&&(e=e()),e.then(e=>{let i=t.success?N(t.success,e):void 0;return i?S.success(i,{id:s,...r,...null==r?void 0:r.success}):S.dismiss(s),e}).catch(e=>{let i=t.error?N(t.error,e):void 0;i?S.error(i,{id:s,...r,...null==r?void 0:r.error}):S.dismiss(s)}),e};var I=(e,t)=>{C({type:1,toast:{id:e,height:t}})},F=()=>{C({type:5,time:Date.now()})},L=new Map,M=1e3,T=(e,t=M)=>{if(L.has(e))return;let r=setTimeout(()=>{L.delete(e),C({type:4,toastId:e})},t);L.set(e,r)},H=e=>{let{toasts:t,pausedAt:r}=O(e);(0,i.useEffect)(()=>{if(r)return;let e=Date.now(),s=t.map(t=>{if(t.duration===1/0)return;let r=(t.duration||0)+t.pauseDuration-(e-t.createdAt);if(r<0){t.visible&&S.dismiss(t.id);return}return setTimeout(()=>S.dismiss(t.id),r)});return()=>{s.forEach(e=>e&&clearTimeout(e))}},[t,r]);let s=(0,i.useCallback)(()=>{r&&C({type:6,time:Date.now()})},[r]),a=(0,i.useCallback)((e,r)=>{let{reverseOrder:s=!1,gutter:i=8,defaultPosition:a}=r||{},o=t.filter(t=>(t.position||a)===(e.position||a)&&t.height),n=o.findIndex(t=>t.id===e.id),l=o.filter((e,t)=>t<n&&e.visible).length;return o.filter(e=>e.visible).slice(...s?[l+1]:[0,l]).reduce((e,t)=>e+(t.height||0)+i,0)},[t]);return(0,i.useEffect)(()=>{t.forEach(e=>{if(e.dismissed)T(e.id,e.removeDelay);else{let t=L.get(e.id);t&&(clearTimeout(t),L.delete(e.id))}})},[t]),{toasts:t,handlers:{updateHeight:I,startPause:F,endPause:s,calculateOffset:a}}},_=x`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,U=x`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,R=x`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,Y=v("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${_} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${U} 0.15s ease-out forwards;
    animation-delay: 150ms;
    position: absolute;
    border-radius: 3px;
    opacity: 0;
    background: ${e=>e.secondary||"#fff"};
    bottom: 9px;
    left: 4px;
    height: 2px;
    width: 12px;
  }

  &:before {
    animation: ${R} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`,Z=x`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,q=v("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${e=>e.secondary||"#e0e0e0"};
  border-right-color: ${e=>e.primary||"#616161"};
  animation: ${Z} 1s linear infinite;
`,B=x`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,Q=x`
0% {
	height: 0;
	width: 0;
	opacity: 0;
}
40% {
  height: 0;
	width: 6px;
	opacity: 1;
}
100% {
  opacity: 1;
  height: 10px;
}`,G=v("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${B} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${Q} 0.2s ease-out forwards;
    opacity: 0;
    animation-delay: 200ms;
    position: absolute;
    border-right: 2px solid;
    border-bottom: 2px solid;
    border-color: ${e=>e.secondary||"#fff"};
    bottom: 6px;
    left: 6px;
    height: 10px;
    width: 6px;
  }
`,J=v("div")`
  position: absolute;
`,K=v("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,V=x`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,W=v("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${V} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,X=({toast:e})=>{let{icon:t,type:r,iconTheme:s}=e;return void 0!==t?"string"==typeof t?i.createElement(W,null,t):t:"blank"===r?null:i.createElement(K,null,i.createElement(q,{...s}),"loading"!==r&&i.createElement(J,null,"error"===r?i.createElement(Y,{...s}):i.createElement(G,{...s})))},ee=e=>`
0% {transform: translate3d(0,${-200*e}%,0) scale(.6); opacity:.5;}
100% {transform: translate3d(0,0,0) scale(1); opacity:1;}
`,et=e=>`
0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}
100% {transform: translate3d(0,${-150*e}%,-1px) scale(.6); opacity:0;}
`,er=v("div")`
  display: flex;
  align-items: center;
  background: #fff;
  color: #363636;
  line-height: 1.3;
  will-change: transform;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1), 0 3px 3px rgba(0, 0, 0, 0.05);
  max-width: 350px;
  pointer-events: auto;
  padding: 8px 10px;
  border-radius: 8px;
`,es=v("div")`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`,ei=(e,t)=>{let r=e.includes("top")?1:-1,[s,i]=k()?["0%{opacity:0;} 100%{opacity:1;}","0%{opacity:1;} 100%{opacity:0;}"]:[ee(r),et(r)];return{animation:t?`${x(s)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${x(i)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}},ea=i.memo(({toast:e,position:t,style:r,children:s})=>{let a=e.height?ei(e.position||t||"top-center",e.visible):{opacity:0},o=i.createElement(X,{toast:e}),n=i.createElement(es,{...e.ariaProps},N(e.message,e));return i.createElement(er,{className:e.className,style:{...a,...r,...e.style}},"function"==typeof s?s({icon:o,message:n}):i.createElement(i.Fragment,null,o,n))});s=i.createElement,c.p=void 0,y=s,g=void 0,b=void 0;var eo=({id:e,className:t,style:r,onHeightUpdate:s,children:a})=>{let o=i.useCallback(t=>{if(t){let r=()=>{s(e,t.getBoundingClientRect().height)};r(),new MutationObserver(r).observe(t,{subtree:!0,childList:!0,characterData:!0})}},[e,s]);return i.createElement("div",{ref:o,className:t,style:r},a)},en=(e,t)=>{let r=e.includes("top"),s=e.includes("center")?{justifyContent:"center"}:e.includes("right")?{justifyContent:"flex-end"}:{};return{left:0,right:0,display:"flex",position:"absolute",transition:k()?void 0:"all 230ms cubic-bezier(.21,1.02,.73,1)",transform:`translateY(${t*(r?1:-1)}px)`,...r?{top:0}:{bottom:0},...s}},el=h`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`,ed=({reverseOrder:e,position:t="top-center",toastOptions:r,gutter:s,children:a,containerStyle:o,containerClassName:n})=>{let{toasts:l,handlers:d}=H(r);return i.createElement("div",{id:"_rht_toaster",style:{position:"fixed",zIndex:9999,top:16,left:16,right:16,bottom:16,pointerEvents:"none",...o},className:n,onMouseEnter:d.startPause,onMouseLeave:d.endPause},l.map(r=>{let o=r.position||t,n=en(o,d.calculateOffset(r,{reverseOrder:e,gutter:s,defaultPosition:t}));return i.createElement(eo,{id:r.id,key:r.id,onHeightUpdate:d.updateHeight,className:r.visible?el:"",style:n},"custom"===r.type?N(r.message,r):a?a(r):i.createElement(ea,{toast:r,position:o}))}))},ec=S},7958:(e,t,r)=>{"use strict";r.d(t,{z:()=>o});var s=r(687),i=r(3210);function a(e){return e.replace(/([A-Z])/g," $1").replace(/^./,e=>e.toUpperCase()).trim()}function o({data:e}){let[t,r]=i.useState(null),o=i.useMemo(()=>t?[...e].sort((e,r)=>{let s=e[t.key],i=r[t.key];if(null==s)return 1;if(null==i)return -1;if("number"==typeof s&&"number"==typeof i)return"asc"===t.direction?s-i:i-s;let a=String(s).toLowerCase(),o=String(i).toLowerCase();return"asc"===t.direction?a.localeCompare(o):o.localeCompare(a)}):e,[e,t]),n=e=>{r(t=>t?.key===e?{key:e,direction:"asc"===t.direction?"desc":"asc"}:{key:e,direction:"asc"})};if(0===e.length)return(0,s.jsx)("div",{className:"rounded-md border",children:(0,s.jsx)("table",{className:"min-w-full",children:(0,s.jsx)("tbody",{children:(0,s.jsx)("tr",{children:(0,s.jsx)("td",{className:"h-24 text-center text-gray-500",children:"No results."})})})})});let l=Object.keys(e[0]);return(0,s.jsx)("div",{className:"w-full",children:(0,s.jsx)("div",{className:"max-h-96 overflow-auto rounded-md border",children:(0,s.jsxs)("table",{className:"min-w-full divide-y divide-gray-200",children:[(0,s.jsx)("thead",{className:"sticky top-0 z-10 bg-gray-50",children:(0,s.jsx)("tr",{children:l.map(e=>(0,s.jsx)("th",{className:"cursor-pointer px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase transition-colors hover:bg-gray-100 sm:px-6 sm:py-3",onClick:()=>n(e),children:(0,s.jsxs)("div",{className:"flex items-center gap-1",children:[(0,s.jsx)("span",{className:"hidden sm:inline",children:a(e)}),(0,s.jsx)("span",{className:"sm:hidden",children:a(e).split(" ")[0]}),t?.key===e&&(0,s.jsx)("span",{className:"text-gray-400",children:"asc"===t.direction?"\uD83D\uDD3C":"\uD83D\uDD3D"})]})},e))})}),(0,s.jsx)("tbody",{className:"divide-y divide-gray-200 bg-white",children:o.map((e,t)=>(0,s.jsx)("tr",{className:"hover:bg-gray-50",children:l.map(t=>(0,s.jsx)("td",{className:"px-3 py-2 text-xs whitespace-nowrap text-gray-900 sm:px-6 sm:py-4 sm:text-sm",children:function(e){if(null==e)return"N/A";if("boolean"==typeof e)return e?"Yes":"No";if("number"==typeof e&&!Number.isInteger(e))return e.toFixed(2);return e.toString()}(e[t]??null)},t))},t))})]})})})}}};