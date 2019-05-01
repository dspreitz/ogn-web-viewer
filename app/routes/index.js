import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { run } from '@ember/runloop';
import window from 'ember-window-mock';

import { scaleFromCenter } from 'ol/extent';
import { transformExtent } from 'ol/proj';

import fetchText from 'ogn-web-viewer/utils/fetch-text';
import { normalizeDeviceId } from 'ogn-web-viewer/utils/normalize-device-id';

const EPSG_4326 = 'EPSG:4326';
const EPSG_3857 = 'EPSG:3857';

export default class extends Route {
  @service filter;
  @service scoring;
  @service history;
  @service ws;
  @service('map') mapService;

  async model() {
    let hash = window.location.hash || '';
    let params = new URLSearchParams(hash.substr(1));

    return Promise.all([this.loadDeviceFilter(params.get('lst')), this.loadTask(params.get('tsk'))]);
  }

  setupController(controller, [filter, task]) {
    if (filter.length !== 0) {
      let records = filter.map(row => {
        let id = normalizeDeviceId(row.ID) || row.ID;
        let name = row.NAME;
        let registration = row.CALL;
        let callsign = row.CN;
        let type = row.TYPE;
        let handicap = 'HANDICAP' in row ? parseFloat(row.HANDICAP) : 1.0;
        return { id, name, registration, callsign, type, handicap };
      });

      run(() => this.filter.add(...records));

      for (let record of records) {
        this.ws.subscribeToId(record.id);
      }

      this.history.loadForIds(...records.map(record => record.id));
    }

    run(() => this.scoring.set('task', task));
    this.mapService.map.updateSize();

    if (task) {
      // zoom map in on the task area
      let bbox = task.bbox.slice();
      scaleFromCenter(bbox, 0.3);
      let extent = transformExtent(bbox, EPSG_4326, EPSG_3857);

      this.mapService.map.getView().fit(extent);
    }
  }

  async loadDeviceFilter(url) {
    if (url) {
      let [text, { default: neatCSV }] = await Promise.all([fetchText(url), import('neat-csv')]);

      return await neatCSV(text);
    }

    return [];
  }

  async loadTask(url) {
    if (url) {
      let { readTaskFromString } = await import('aeroscore/dist/src/read-task');
      return readTaskFromString(await fetchText(url));
    }
  }
}
