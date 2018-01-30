import yaml from 'js-yaml';
import fs from 'fs';
import _ from 'lodash';
import Victor from 'victor';
import math from 'mathjs';

let doc = null;

try {
    doc = yaml.safeLoad(fs.readFileSync('data.yml', 'utf8'));
    console.log(doc);
} catch (e) {
    console.log(e);
}

let output = "";
let output2 = "";

const add = (text) => output += text + "\n";
const add2 = (text) => output2 += text + "\n";
const yp2sp = (pos) => ({x: 500 + pos.x * 10, y: 1000 - 50 - pos.y * 10});

add(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="250 500 750 1000">`);

let last_stop = _.mapValues(doc.lines, () => 0);

_.map(doc.stops, (stop, current_stop_id) => {
    _.map(stop.lines, (lines, group_i) => {
        const line = lines[0];
        const line_last_stop = last_stop[line];
        console.log(`from ${line_last_stop} to ${current_stop_id}`);

        const start_dir = Victor.fromObject(doc.stops[line_last_stop].direction).norm().multiplyScalarY(-1);
        const end_dir = Victor.fromObject(doc.stops[current_stop_id].direction).norm().multiplyScalarY(-1);

        console.log(start_dir, end_dir);

        const start_per_dir = start_dir.clone().rotate(Math.PI / 2);
        const end_per_dir = end_dir.clone().rotate(Math.PI / 2);

        console.log(start_per_dir, end_per_dir);

        const start_leftmost_count = -(doc.stops[line_last_stop].lines.length - 1) / 2;
        const start_vec_leftmost = new Victor(start_leftmost_count, start_leftmost_count);

        const end_leftmost_count = -(doc.stops[current_stop_id].lines.length - 1) / 2;
        const end_vec_leftmost = new Victor(end_leftmost_count, end_leftmost_count);

        // console.log(leftmost, vec_leftmost);

        const start_leftmost = start_per_dir.clone().multiply(start_vec_leftmost);
        const end_leftmost = end_per_dir.clone().multiply(end_vec_leftmost);

        console.log(start_leftmost, end_leftmost);

        const start_group_id = _.findIndex(doc.stops[line_last_stop].lines, (line_list) => line_list.indexOf(line) >= 0);
        const end_group_id = group_i;

        const start_vec_group = new Victor(start_group_id, start_group_id);
        const end_vec_group = new Victor(end_group_id, end_group_id);

        const start_current = start_leftmost.clone().add(start_per_dir.clone().multiply(start_vec_group));
        const end_current = end_leftmost.clone().add(end_per_dir.clone().multiply(end_vec_group));

        console.log(start_current, end_current);

        const start_x = yp2sp(doc.stops[line_last_stop].position).x + 5 + start_current.x * 10;
        const start_y = yp2sp(doc.stops[line_last_stop].position).y + 5 + start_current.y * 10;
        const end_x = yp2sp(doc.stops[current_stop_id].position).x + 5 + end_current.x * 10;
        const end_y = yp2sp(doc.stops[current_stop_id].position).y + 5 + end_current.y * 10;

        const color = doc.lines[line].color;

        if (current_stop_id !== 0) {

            if (start_dir.clone().subtract(end_dir).length() < 0.000001) {
                add(`<line x1="${start_x}" y1="${start_y}" x2="${end_x}" y2="${end_y}" stroke="${color}" stroke-width="6"/>`);
            } else {
                const intersect = math.intersect(
                    [start_x, start_y],
                    [start_x + start_dir.x * 1000, start_y + start_dir.y * 1000],
                    [end_x + end_dir.x * -1000, end_y + end_dir.y * -1000],
                    [end_x, end_y],
                );

                const mid_x = intersect[0];
                const mid_y = intersect[1];

                const mid_start_x = mid_x - start_dir.x * 10;
                const mid_start_y = mid_y - start_dir.y * 10;
                const mid_end_x = mid_x + end_dir.x * 10;
                const mid_end_y = mid_y + end_dir.y* 10;

                add(`<line x1="${start_x}" y1="${start_y}" x2="${mid_start_x}" y2="${mid_start_y}" stroke="${color}" stroke-width="6"/>`);
                add(`<path fill="none" stroke="${color}" stroke-width="6" d="M${mid_start_x},${mid_start_y} Q${mid_x},${mid_y} ${mid_end_x},${mid_end_y}" />`);
                add(`<line x1="${mid_end_x}" y1="${mid_end_y}" x2="${end_x}" y2="${end_y}" stroke="${color}" stroke-width="6"/>`);
            }
            _.map(lines, (line) => {
                last_stop[line] = current_stop_id;
            });
        }

        if (stop.type === 'stop') {
            add2(`<circle cx="${end_x}" cy="${end_y}" r="3" fill= "#fff" stroke="#333333" stroke-width="3px" />`);
        }
    });
    // add(`<rect x="${yp2sp(stop.position).x}" y="${yp2sp(stop.position).y}" width="10" height="10" fill= "#fff" stroke="#333333" stroke-width="3px" />`);
});

// add(`<rect x="10" y="10" width="200" height="100" fill= "#fff" stroke="#333333" stroke-width="3px" />`);

// _.map(doc.stops, (stop) => {
//     add(`<rect x="${yp2sp(stop.position).x}" y="${yp2sp(stop.position).y}" width="10" height="10" fill= "#fff" stroke="#333333" stroke-width="3px" />`);
// });

add(output2);

add(`</svg>`);

fs.writeFileSync('output.svg', output, 'utf-8');
