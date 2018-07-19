import axios from 'axios';

class DDBService {
  constructor() {
    this.devices = {};
  }

  async update() {
    let response = await axios('https://ogn.fva.cloud/api/ddb');
    this.devices = response.data;
  }
}

let service = new DDBService();

export default service;
