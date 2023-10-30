function create_download_tsv(rows, columns, include_headers, include_full, matched){
    let a = [];
    let b = [];
    if(include_headers){
        for(let y of columns){
            b.push(y[0]);
        }
        a.push(b.join('\t'))
    }
    let rs;
    if(include_full == 'yes'){
        rs = rows;
    }
    else if(include_full == 'no'){
        rs = matched;
    }
    for(let x of rs){
        b = [];
        for(let y of columns){
            b.push(x[y[1]]);
        }
        a.push(b.join('\t'));
    }
    return a.join('\n') + "\n";
}

function create_download_url(tsv){
    return URL.createObjectURL(new Blob([tsv], {type : 'text/tab-separated-values'}));
}

export { create_download_tsv, create_download_url }
