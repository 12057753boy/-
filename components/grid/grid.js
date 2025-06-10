// components/grid/grid.js
Component({
  properties: {
    gridData: {
      type: Array,
      value: []
    },
    selectedCell: {
      type: Number,
      value: -1
    },
    disabled: {
      type: Boolean,
      value: false
    }
  },

  data: {
    
  },

  methods: {
    onCellTap(e) {
      if (this.properties.disabled) return
      
      const cellId = e.currentTarget.dataset.id
      this.triggerEvent('cellTap', { cellId: cellId })
    }
  }
})
