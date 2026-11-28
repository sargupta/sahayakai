import re
from dc2jsx import recolour
def scope(css, root, kf_prefix):
    # Prefix keyframe NAMES only: in @keyframes declarations and in animation /
    # animation-name values. Class selectors that share a name (.pulse, .rv)
    # must stay as they are, or the markup's classes stop matching.
    names=set(re.findall(r'@keyframes\s+([\w-]+)',css))
    css=re.sub(r'@keyframes\s+([\w-]+)',lambda m:'@keyframes '+kf_prefix+m.group(1),css)
    def anim(m):
        v=m.group(2)
        for n in sorted(names,key=len,reverse=True):
            v=re.sub(r'(?<![\w-])%s(?![\w-])'%re.escape(n), kf_prefix+n, v)
        return m.group(1)+v
    css=re.sub(r'(animation(?:-name)?\s*:)([^;}]*)',anim,css)
    css=recolour(css)
    out=[];i=0
    def rules(block):
        res=[];j=0
        while j<len(block):
            k=block.find('{',j)
            if k<0: break
            sel=block[j:k].strip()
            if sel.startswith('@keyframes'):
                depth=0;m=k
                while True:
                    if block[m]=='{':depth+=1
                    elif block[m]=='}':
                        depth-=1
                        if depth==0:break
                    m+=1
                res.append(block[j:m+1].strip()); j=m+1; continue
            if sel.startswith('@media') or sel.startswith('@supports'):
                depth=0;m=k
                while True:
                    if block[m]=='{':depth+=1
                    elif block[m]=='}':
                        depth-=1
                        if depth==0:break
                    m+=1
                res.append(sel+'{'+rules(block[k+1:m])+'}'); j=m+1; continue
            e=block.find('}',k)
            body=block[k+1:e]
            sels=[]
            for s in sel.split(','):
                s=s.strip()
                if s in ('body','html'): sels.append(root)
                elif s.startswith(root): sels.append(s)
                else: sels.append(root+' '+s)
            # React's server HTML writes style="font-size:11px" (no space); the
            # design's attribute selectors carry a space. Match both forms.
            more=[x.replace(m.group(0),'[style*="%s:%s"]'%(m.group(1),m.group(2))) for x in sels for m in [re.search(r'\[style\*="([\w-]+): ([^"]+)"\]',x)] if m]
            res.append(','.join(sels+more)+'{'+body+'}'); j=e+1
        return '\n'.join(res)
    return rules(css)
