// data from https://www.facebook.com/maydaySATARANA/photos/pcb.320533031770557/320532675103926/?type=3&theater

import yaml from 'js-yaml';
import fs from 'fs';
import _ from 'lodash';
import Victor from 'victor';
import math from 'mathjs';
import XLSX from 'xlsx';

let doc = null;

const scale = 10;

const path_width = 1.5;
const path_neighbor_gap = 0.7;
const path_pad_start = 3;
const path_pad_end = 1;

const stop_radius = 0.6;
const stop_name_gap = 1;
const stop_name_size = 2;
const stop_font_style = "font-family: TH Sarabun New; font-weight: bold;";

// try {
//     doc = yaml.safeLoad(fs.readFileSync('data/data_test.yml', 'utf8'));
//     // console.log(doc);
// } catch (e) {
//     console.log(e);
//     process.exit(1);
// }

const i2c = (i) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.substr(i - 1, 1);

const wb = XLSX.read(fs.readFileSync('data/data_gpo.xlsx'), {type: 'buffer'});
const ws = wb.Sheets[wb.SheetNames[0]];
doc = {
    lines: [],
    stops: [],
};

let col = 2;
while (true) {
    if (!ws[`${i2c(col)}1`] || !ws[`${i2c(col)}1`].v || col === 10) break;

    let stops_raw = [];
    let row = 2;
    while (true) {
        if (!ws[`A${row}`] || !ws[`A${row}`].v) break;
        const d = ws[`${i2c(col)}${row}`];
        if (d) {
            if (isNaN(parseInt(d.v))) {
                stops_raw.push({
                    'stop': `s${row}`,
                    'sort': row,
                });
            } else {
                stops_raw.push({
                    'stop': `s${row}`,
                    'sort': parseInt(d.v),
                });
            }
        }
        row++;
    }
    const stops = _.map(_.sortBy(stops_raw, 'sort'), 'stop');

    const line = {
        no: ws[`${i2c(col)}1`].v,
        name: ws[`${i2c(col)}1`].v,
        color: col - 1,
        stops: stops,
    };
    doc.lines.push(line);
    col++;
}

let row = 2;
while (true) {
    if (!ws[`A${row}`] || !ws[`A${row}`].v) break;
    const metacol = 10;

    let lines_raw = [];
    let col = 2;
    while (true) {
        if (!ws[`${i2c(col)}1`] || !ws[`${i2c(col)}1`].v || col === metacol) break;
        const d = ws[`${i2c(col)}${row}`];
        if (d) {
            const txt = `${d.v}`;
            if (txt.indexOf(',') < 0) {
                lines_raw.push({
                    'line': [ws[`${i2c(col)}1`].v],
                    'sort': col,
                });
            } else {
                lines_raw.push({
                    'line': [ws[`${i2c(col)}1`].v],
                    'sort': parseInt(txt.substring(txt.indexOf(',') + 1)),
                });
            }
        }
        col++;
    }
    // console.log(ws[`A${row}`].v, lines_raw);
    const lines = _.map(_.sortBy(lines_raw, 'sort'), 'line');

    const stop = {
        id: `s${row}`,
        name: ws[`A${row}`].v,
        type: (ws[`A${row}`].v === '-' ? 'blank' : 'stop'),
        position: {
            x: parseInt(ws[`${i2c(metacol + 0)}${row}`].v),
            y: parseInt(ws[`${i2c(metacol + 1)}${row}`].v),
        },
        direction: {
            x: parseInt(ws[`${i2c(metacol + 2)}${row}`].v),
            y: parseInt(ws[`${i2c(metacol + 3)}${row}`].v),
        },
        pad_left: parseInt(ws[`${i2c(metacol + 4)}${row}`].v),
        pad_right: parseInt(ws[`${i2c(metacol + 5)}${row}`].v),
        lines: lines,
    };
    doc.stops.push(stop);
    row++;
}

console.log(doc);
if (!doc) process.exit(1);

// generate stops' lines from lines' stops
// for yml only
// _.map(doc.lines, (line) => {
//     const line_no = line.no;
//     _.map(line.stops, (stop_id) => {
//         const stop_index = _.findIndex(doc.stops, ({id}) => id === stop_id);
//         if (stop_index < 0) throw new Error(`stop ${stop_id} not found for line ${line_no}`);
//
//         doc.stops[stop_index].lines = [
//             ...(doc.stops[stop_index].lines || []),
//             (line.combo ? line.combo : [line_no]),
//         ];
//     });
// });

_.map(doc.stops, (stop, stop_idx) => {
    doc.stops[stop_idx].lines_real = doc.stops[stop_idx].lines || [];
    doc.stops[stop_idx].lines = [
        ...(Array(stop.pad_left || 0).fill([])),
        ...(doc.stops[stop_idx].lines || []),
        ...(Array(stop.pad_right || 0).fill([])),
    ];
    doc.stops[stop_idx].first_line_idx = stop.pad_left || 0;
    doc.stops[stop_idx].last_line_idx = (stop.pad_left || 0) + doc.stops[stop_idx].lines_real.length - 1;
});

// console.log(doc.stops.map(({lines}) => lines));

let output = "";
let output2 = "";

const add = (text) => output += text + "\n";
const add2 = (text) => output2 += text + "\n";
const yp2sp = (pos) => ({x: 500 + pos.x * scale, y: 1000 - 200 - pos.y * scale});

add(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -500 1500 1500">`);

add(`<rect x="-1000" y="-1000" width="3000" height="3000" fill="#DCDCDC" />`)

let strokes = {};

const add_stroke = (line_no, text) => strokes[line_no] = [...(strokes[line_no] || []), text];

// _.map(doc.stops, (stop, current_stop_idx) => {
//     _.map(stop.lines, (lines, group_i) => {

_.map(doc.lines, (line, line_idx) => {
    const line_no = line.no;
    let last_stop_id = line.stops[0];
    _.map(line.stops, (stop_id, stop_idx) => {

        const last_stop = _.find(doc.stops, stop => stop.id === last_stop_id);
        const current_stop = _.find(doc.stops, stop => stop.id === stop_id);

        last_stop_id = stop_id;

        console.log(`line ${line_no} from ${last_stop.id} to ${current_stop.id}`);

        const start_dir = Victor.fromObject(last_stop.direction).norm().multiplyScalarY(-1);
        const end_dir = Victor.fromObject(current_stop.direction).norm().multiplyScalarY(-1);

        // console.log(start_dir, end_dir);

        const start_per_dir = start_dir.clone().rotate(Math.PI / 2);
        const end_per_dir = end_dir.clone().rotate(Math.PI / 2);

        // console.log(start_per_dir, end_per_dir);

        // 1 => 0p 0g
        // 2 => 0.5p 0.5g
        // 3 => 1p 1g
        // 4 => 1.5p 1.5g

        const start_leftmost_count = -(last_stop.lines.length - 1) / 2;
        const end_leftmost_count = -(current_stop.lines.length - 1) / 2;

        // console.log(leftmost, vec_leftmost);

        const path_and_gap = path_width + path_neighbor_gap;

        const start_leftmost = start_per_dir.clone().multiplyScalar(start_leftmost_count * path_and_gap);
        const end_leftmost = end_per_dir.clone().multiplyScalar(end_leftmost_count * path_and_gap);

        // console.log(start_leftmost, end_leftmost);

        const start_group_id = _.findIndex(last_stop.lines, (line_list) => line_list.indexOf(line_no) >= 0);
        const end_group_id = _.findIndex(current_stop.lines, (line_list) => line_list.indexOf(line_no) >= 0);

        const start_current = start_leftmost.clone().add(start_per_dir.clone().multiplyScalar(start_group_id * path_and_gap)).multiplyScalar(scale);
        const end_current = end_leftmost.clone().add(end_per_dir.clone().multiplyScalar(end_group_id * path_and_gap)).multiplyScalar(scale);

        // console.log(start_current, end_current);

        const start_x_real = yp2sp(last_stop.position).x + start_current.x;
        const start_y_real = yp2sp(last_stop.position).y + start_current.y;
        const end_x_real = yp2sp(current_stop.position).x + end_current.x;
        const end_y_real = yp2sp(current_stop.position).y + end_current.y;

        if (current_stop.type === 'stop') {
            add2(`<circle cx="${end_x_real}" cy="${end_y_real}" r="${stop_radius * scale}" fill= "#fff" stroke="#333333" stroke-width="0" />`);

            const is_upward = (new Victor(0, 1)).dot(end_dir) < 0;

            let gap = end_per_dir.clone().multiplyScalar(stop_name_gap * scale).add(end_dir.clone().multiplyScalar(-stop_name_size * scale / 4));
            let should_have_title = false;

            if (end_group_id === current_stop.last_line_idx && is_upward) {
                should_have_title = true;
            } else if (end_group_id === current_stop.first_line_idx && !is_upward) {
                gap = gap.clone().multiplyScalar(-1);
                should_have_title = true;
            }

            if (should_have_title) {
                add2(`<text x="${end_x_real + gap.x}" y="${end_y_real + gap.y}" style="${stop_font_style}" font-size="${stop_name_size * scale}">${current_stop.name}</text>`);
            }
        }

        const start_pad = stop_idx === 1 ? start_dir.clone().multiplyScalar(-path_pad_start * scale) : new Victor(0, 0);
        const end_pad = stop_idx === line.stops.length - 1 ? end_dir.clone().multiplyScalar(path_pad_end * scale) : new Victor(0, 0);

        const start_x = start_x_real + start_pad.x;
        const start_y = start_y_real + start_pad.y;
        const end_x = end_x_real + end_pad.x;
        const end_y = end_y_real + end_pad.y;

        if (last_stop.id !== current_stop.id) {

            if (start_dir.clone().subtract(end_dir).length() < 0.000001) {

                if ((new Victor(end_x_real - start_x_real, end_y_real - start_y_real)).norm().subtract(start_dir).length() > 0.000001) {
                    console.log("== WARN: stops has same direction not aligning in straight line")
                    console.log(new Victor(end_x_real - start_x_real, end_y_real - start_y_real).norm(), start_dir);
                }

                // add(`<line x1="${start_x}" y1="${start_y}" x2="${end_x}" y2="${end_y}" stroke="${color}" stroke-width="${path_width}"/>`);
                add_stroke(line_no, `L${start_x},${start_y}`);
                add_stroke(line_no, `L${end_x},${end_y}`);
            } else {
                const intersect = math.intersect(
                    [start_x, start_y],
                    [start_x + start_dir.x * 10000, start_y + start_dir.y * 10000],
                    [end_x + end_dir.x * -10000, end_y + end_dir.y * -10000],
                    [end_x, end_y],
                );

                const mid_x = intersect[0];
                const mid_y = intersect[1];

                const mid_start_x = mid_x - start_dir.x * scale;
                const mid_start_y = mid_y - start_dir.y * scale;
                const mid_end_x = mid_x + end_dir.x * scale;
                const mid_end_y = mid_y + end_dir.y * scale;

                // add(`<line x1="${start_x}" y1="${start_y}" x2="${mid_start_x}" y2="${mid_start_y}" stroke="${color}" stroke-width="${path_width}"/>`);
                // add(`<path fill="none" stroke="${color}" stroke-width="${path_width}" d="M${mid_start_x},${mid_start_y} Q${mid_x},${mid_y} ${mid_end_x},${mid_end_y}" />`);
                // add(`<line x1="${mid_end_x}" y1="${mid_end_y}" x2="${end_x}" y2="${end_y}" stroke="${color}" stroke-width="${path_width}"/>`);
                add_stroke(line_no, `L${start_x},${start_y}`);
                add_stroke(line_no, `L${mid_start_x},${mid_start_y}`);
                add_stroke(line_no, `Q${mid_x},${mid_y}`);
                add_stroke(line_no, `${mid_end_x},${mid_end_y}`);
                add_stroke(line_no, `L${end_x},${end_y}`);
            }
            // _.map(lines, (line) => {
            //     last_stop[line] = current_stop_idx;
            // });
        }

    });
    // add(`<rect x="${yp2sp(stop.position).x}" y="${yp2sp(stop.position).y}" width="10" height="10" fill= "#fff" stroke="#333333" stroke-width="3px" />`);
});

// console.log(strokes);

_.map(strokes, (dots, line_no) => {
    const color = _.find(doc.lines, line => `${line.no}` === `${line_no}`).color;

    const real_color = {
        1: '#EE7733',
        2: '#F8D130',
        3: '#F3A34D',
        4: '#BE9976',
        5: '#27AA9E',
        6: '#94328A',
        7: '#F38330',
        8: '#EB3233',
    }[color] || color;

    const path = dots.join(" ");
    add(`<path fill="none" stroke="${real_color}" stroke-width="${path_width * scale}" d="M${dots[0].substring(1)} ${path}" />`);
});

// add(`<rect x="10" y="10" width="200" height="100" fill= "#fff" stroke="#333333" stroke-width="3px" />`);

// _.map(doc.stops, (stop) => {
//     add(`<rect x="${yp2sp(stop.position).x}" y="${yp2sp(stop.position).y}" width="10" height="10" fill= "#fff" stroke="#333333" stroke-width="3px" />`);
// });

add(output2);

add(`</svg>`);

fs.writeFileSync('output.svg', output, 'utf-8');
