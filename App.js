Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    items: [
        {
            xtype: 'container',
            itemId: 'exportBtn',
            cls: 'export-button'
        },
        {
            xtype: 'container',
            itemId: 'environmentCombobox',
            cls: 'environment-combo-box'
        },
        {
            xtype: 'container',
            itemId: 'gridContainer'
        }
    ],
    launch: function() {
        this._myMask = new Ext.LoadMask(Ext.getBody(), {msg:"Loading data..."});
        this._myMask.show();
        
        this.down('#environmentCombobox').add({
            xtype: 'rallyfieldvaluecombobox',
            itemId: 'environmentComboBox',
            model: 'TestCaseResult',
            field: 'c_PhysicalEnvironment',
            value: 'FIT',
            listeners: {
                scope: this,
                select: this._onEnvironmentSelect,
                ready: this._initStore
            },
        });
   },
    _getEnvironmentFilter: function() {
        return {
            property: 'Environment',
            operator: '=',
            value: this.down('#environmentComboBox').getRawValue()
        };
    },
    _onEnvironmentSelect: function() {
        var store = this._grid.getStore();
    
        store.clearFilter(true);
        store.filter(this._getEnvironmentFilter());
    },
   _initStore: function() {
        this._defectsStore = Ext.create('Rally.data.wsapi.Store', {
            model: 'Defect',
            autoLoad: true,
            remoteSort: false,
            fetch:[
            	"FormattedID",
            	"State",
            	"TestCase"
        	],
            limit: Infinity
        });
        this._defectsStore.on('load',function () {
            this._testCaseStore = Ext.create('Rally.data.wsapi.Store', {
                model: 'TestCase',
                autoLoad: true,
                remoteSort: false,
                fetch:[
            	    "FormattedID", 
                	"Name",
                	"Type",
                	"WorkProduct",
                	"Milestones",
                	"Defects",
                	"Results"
            	],
                limit: Infinity
            });
            
            this._testCaseStore.on('load',function () {
                Ext.create('Rally.data.wsapi.Store', {
                    model: 'TestCaseResult',
                    autoLoad: true,
                    remoteSort: false,
                    fetch: [
                        "Build",
                        "Date",
                        "TestCase",
                        "Tester",
                        "Verdict",
                        "c_PhysicalEnvironment",
                        "c_VistABuild",
                        "c_VistAInstance"
                    ],
                    limit: Infinity,
                    listeners: {
                        load: this._onDataLoaded,
                        scope: this
                    }
                });
            },this);
        },this);
    },
    _onDataLoaded: function(store, data) {
        _.each(data, function(testresult) {
            testresult.set("TesterName", testresult.data.Tester._refObjectName);
            testresult.set("Environment", testresult.data.c_PhysicalEnvironment);
            _.each(this._testCaseStore.data.items , function(testcase) {
                if (testcase.data._ref === testresult.data.TestCase._ref) {
                    testresult.set("TestCase", testcase);
                    testresult.set("TestCaseName", testcase.data.Name);
                    testresult.set("TestCaseType", testcase.data.Type);
                    testresult.set("TestCaseWorkProduct", testcase.data.WorkProduct);
                    if (testcase.data.Defects && testcase.data.Defects.Count > 0) {
                        var defectHtml = [];
                        _.each(this._defectsStore.data.items, function(defect) {
                            if (defect.data.TestCase && defect.data.TestCase.FormattedID === testcase.data.FormattedID) {
                                defectHtml.push('<a href="' + Rally.nav.Manager.getDetailUrl(defect) + '">' + defect.data.FormattedID + "</a> - " + defect.data.State);
                            }
                        }, this);
                        testresult.set('OpenDefects', defectHtml.join("</br>"));
                    }
                }
            }, this);
        }, this);
        this._makeGrid(data);
        this._onEnvironmentSelect();
    },
    
    _makeGrid: function(testcases){
        this._myMask.hide();
        var store = Ext.create('Rally.data.custom.Store', {
            data: testcases,
            proxy: {
                type:'memory'
            }
        });
        this._testcases = testcases;
        this._grid = Ext.create('Rally.ui.grid.Grid',{
            itemId: 'testcasesGrid',
            store: store,
            showRowActionsColumn: false,
            showPagingToolbar: false,
            columnCfgs: [
                { 
                	text: "Test Case ID", dataIndex: "TestCase", 
                	renderer : function(value) {
                	    return value ? '<a href="' + Rally.nav.Manager.getDetailUrl(value) + '">' + value.data.FormattedID + "</a>" : void 0;
                	}
                }, {
                    text: "Test Case Name", dataIndex: "TestCaseName", flex: 1
                }, {
                    text: "Test Case Type", dataIndex: "TestCaseType"
                }, {
                    text: "Work Product ID", dataIndex: "TestCaseWorkProduct",
                    renderer: function(value) {
                        return value ? '<a href="' + Rally.nav.Manager.getDetailUrl(value) + '">' + value.FormattedID + "</a>" : void 0;
                    },
                    getSortParam: function() {
                        return "WorkProductNumericID";  
                    }
                }, {
                    text: "Test Results Build", dataIndex: "Build"
                }, {
                    text: "Test Results Date", dataIndex: "Date"
                }, {
                    text: "Test Results Tester", dataIndex: "TesterName"
                }, {
                    text: "Test Results Verdict", dataIndex: "Verdict", sortable: false
                }, {
                    text: "Test Results Physical Environment", dataIndex: "c_PhysicalEnvironment"
                }, {
                    text: "Test Results VistA Build", dataIndex: "c_VistABuild"
                }, {
                    text: "Test Results VistA Instance", dataIndex: "c_VistAInstance"
                }, {
                    text: "Defects", dataIndex: "OpenDefects"
                }
            ]
        });
        this.down('#gridContainer').add(this._grid);
        this.down('#exportBtn').add({
            xtype: 'rallybutton',
            text: 'Export to CSV',
            handler: this._onClickExport,
            scope: this
        });
    },

    _onClickExport: function(){
        var data = this._getCSV();
        window.location = 'data:text/csv;charset=utf8,' + encodeURIComponent(data);
    },
    
    _getCSV: function () {
        var cols    = this._grid.columns;
        var data = '';
        
        _.each(cols, function(col) {
            data += this._getFieldTextAndEscape(col.text) + ',';
        }, this);
        data += "Milestones,";
        data += "\r\n";

        _.each(this._testcases, function(record) {
            _.each(cols, function(col) {
                var fieldName = col.dataIndex;
                if (fieldName ==="WorkProduct" && record.data.WorkProduct) {
                    data += this._getFieldTextAndEscape(record.data.WorkProduct.FormattedID) + ',';
                } else if (fieldName ==="LastRun") {
                    var lastRunText = '';
                    if (record.data.LastRun) {
                        lastRunText = record.data.LastRun.toString();
                    }
                    data += this._getFieldTextAndEscape(lastRunText) + ',';
                } else if (fieldName === "OpenDefects" && record.data.OpenDefects) {
                    var text = '\"';
                    _.each(this._defectsStore.data.items, function(defect) {
                        if (defect.data.TestCase && defect.data.TestCase.FormattedID === record.data.FormattedID) {
                            text += defect.data.FormattedID + ' - ' + defect.data.State + '\n';
                        }
                    }, this);
                    text += '\"';
                    data += text + ',';
                } else if (fieldName === "Date") {
                     data += this._getFieldTextAndEscape(record.data.Date.toString()) + ',';
                } else if (fieldName === "TestCaseWorkProduct" && record.data.TestCaseWorkProduct) {
                     data += this._getFieldTextAndEscape(record.data.TestCaseWorkProduct.FormattedID) + ',';
                } else {
                    data += this._getFieldTextAndEscape(record.get(fieldName)) + ',';
                }
            }, this);
            data += this._getMilestonesForCSV(record);
            data += "\r\n";
        }, this);

        return data;
    },
    _getMilestonesForCSV: function(testcases) {
        var milestones = '';
        if(testcases.data.WorkProduct) {
            _.each(testcases.data.WorkProduct.Milestones._tagsNameArray, function(milestone) {
                milestones += this._getFieldTextAndEscape(milestone.Name) + ' ';
            }, this);
        }
        return milestones;
    },
    _getFieldTextAndEscape: function(fieldData) {
        var string  = this._getFieldText(fieldData);  
        return this._escapeForCSV(string);
    },
    _getFieldText: function(fieldData) {
        var text;
        if (fieldData === null || fieldData === undefined || !fieldData.match) {
            text = '';
        } else if (fieldData._refObjectName) {
            text = fieldData._refObjectName;
        }else {
            text = fieldData;
        }
        return text;
    },
     _escapeForCSV: function(string) {
        if (string.match(/,/)) {
            if (!string.match(/"/)) {
                string = '"' + string + '"';
            } else {
                string = string.replace(/,/g, ''); 
            }
        }
        return string;
    }
});